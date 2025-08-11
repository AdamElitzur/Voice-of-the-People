from typing import List, Dict, Optional

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from torch.nn.functional import softmax
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE


LABEL_MAP = {0: "left", 1: "center", 2: "right"}


class QAPair(BaseModel):
    question: str
    answer: str
    id: Optional[str] = None



app = FastAPI(title="Political Leaning Classifier API")


# Load model/tokenizer at startup and keep in memory
tokenizer = AutoTokenizer.from_pretrained("launch/POLITICS")
model = AutoModelForSequenceClassification.from_pretrained("matous-volf/political-leaning-politics")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(items: List[QAPair]):
    # Prepare text batch from Q/A pairs (use answer as primary input)
    answers: List[str] = []
    for item in items:
        if item and item.answer and item.answer.strip():
            answers.append(item.answer.strip())
        else:
            answers.append("")

    if not any(answers):
        return {"items": [], "aggregates": {}}

    with torch.no_grad():
        tokens = tokenizer(
            answers,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=256,
        )
        tokens = {k: v.to(device) for k, v in tokens.items()}
        outputs = model(**tokens, output_hidden_states=True, return_dict=True)
        logits = outputs.logits  # [B,3]
        probabilities = softmax(logits, dim=1)  # [B,3]
        last_hidden = outputs.hidden_states[-1]  # [B,T,H]
        cls_embeddings = last_hidden[:, 0, :]  # [B,H]

    probs_list = probabilities.detach().cpu().tolist()
    top_indices = torch.argmax(probabilities, dim=1).tolist()

    # Ideology axis from classifier head
    W = model.classifier.out_proj.weight.data.to(device)  # [3,H]
    b = model.classifier.out_proj.bias.data.to(device)    # [3]
    a_vec = (W[2] - W[0]).detach()  # [H]
    c_bias = (b[2] - b[0]).detach()  # scalar
    ideology_raw = (cls_embeddings @ a_vec) + c_bias  # [B]
    ideology_raw = ideology_raw.detach().cpu().tolist()

    # Normalize ideology to [-1,1] using tanh of z-score over the batch
    import math
    import numpy as np
    s = np.array(ideology_raw, dtype=np.float32)
    s_mean = float(s.mean())
    s_std = float(s.std()) if s.std() > 1e-6 else 1.0
    ideology_score = np.tanh(((s - s_mean) / s_std) / 2.0).tolist()

    # Build item-level results
    items_out = []
    for i, (qa, idx, p) in enumerate(zip(items, top_indices, probs_list)):
        label = LABEL_MAP.get(idx, str(idx))
        sorted_probs = sorted(p, reverse=True)
        margin = float(sorted_probs[0] - sorted_probs[1])
        entropy = -sum(pi * math.log(max(pi, 1e-12)) for pi in p) / math.log(3.0)
        extremeness = float(max(p[0], p[2]) - p[1])
        item = {
            "id": qa.id or f"{i}",
            "question": qa.question,
            "answer": qa.answer,
            "pred_index": int(idx),
            "pred_label": label,
            "probs": {
                "left": float(p[0]),
                "center": float(p[1]),
                "right": float(p[2]),
            },
            "pred_score": float(p[idx]),
            "margin": margin,
            "entropy": float(entropy),
            "extremeness": extremeness,
            "ideology_raw": float(ideology_raw[i]),
            "ideology_score": float(ideology_score[i]),
        }
        items_out.append(item)

    # Projections
    proj = {}
    emb_np = cls_embeddings.detach().cpu().numpy()
    # Always compute PCA (with small-sample fallback)
    n_samples = emb_np.shape[0]
    if n_samples >= 2:
        pca = PCA(n_components=2, random_state=42)
        pc = pca.fit_transform(emb_np)
        proj["pca"] = {
            "coords": pc.tolist(),
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "mean": pca.mean_.tolist(),
            "components": pca.components_.tolist(),
        }
        for i, it in enumerate(items_out):
            it.setdefault("projections", {})["pca"] = [float(pc[i, 0]), float(pc[i, 1])]
    else:
        # Single point: place at origin, include minimal metadata
        pc = [[0.0, 0.0] for _ in range(n_samples)]
        proj["pca"] = {
            "coords": pc,
            "explained_variance_ratio": [],
            "note": "insufficient_samples_for_2d_pca",
        }
        for i, it in enumerate(items_out):
            it.setdefault("projections", {})["pca"] = [0.0, 0.0]

    # Try t-SNE
    # t-SNE with adaptive perplexity and sample-size guard
    if n_samples >= 3:
        try:
            # perplexity must be < n_samples; choose a small, safe value
            safe_perp = max(2, min(30, (n_samples - 1) / 3.0))
            # Use broadly compatible args (avoid learning_rate="auto" and n_iter to support older sklearn)
            tsne = TSNE(n_components=2, perplexity=safe_perp, init="pca", random_state=42)
            ts = tsne.fit_transform(emb_np)
            proj["tsne"] = {"coords": ts.tolist(), "perplexity": safe_perp}
            for i, it in enumerate(items_out):
                it.setdefault("projections", {})["tsne"] = [float(ts[i, 0]), float(ts[i, 1])]
        except Exception as e:
            proj["tsne"] = {"error": "tsne_failed", "detail": str(e)[:200]}
    else:
        proj["tsne"] = {"error": "too_few_samples", "min_samples": 3}

    # Try UMAP
    # UMAP with safe parameters and sample-size guard
    if n_samples >= 3:
        try:
            import umap

            n_neighbors = max(2, min(15, n_samples - 1))
            reducer = umap.UMAP(n_components=2, n_neighbors=n_neighbors, min_dist=0.1, random_state=42)
            um = reducer.fit_transform(emb_np)
            proj["umap"] = {"coords": um.tolist(), "params": {"n_neighbors": n_neighbors, "min_dist": 0.1}}
            for i, it in enumerate(items_out):
                it.setdefault("projections", {})["umap"] = [float(um[i, 0]), float(um[i, 1])]
        except Exception as e:
            proj["umap"] = {"error": "umap_failed", "detail": str(e)[:200]}
    else:
        proj["umap"] = {"error": "too_few_samples", "min_samples": 3}

    # Always include raw embeddings
    for i, it in enumerate(items_out):
        it["embedding"] = emb_np[i].tolist()

    # Aggregates
    from collections import Counter

    counts_by_label = Counter([it["pred_label"] for it in items_out])
    aggregates = {
        "counts_by_pred_label": dict(counts_by_label),
        "projections": proj,
    }

    return {"items": items_out, "aggregates": aggregates}


# No other analysis endpoints; /analyze is the single API for Q/A batch processing.


# To run: uvicorn ai.backend.server:app --host 0.0.0.0 --port 8000


