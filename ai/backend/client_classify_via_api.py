import argparse
import json
from pathlib import Path
from typing import Iterable, List

import requests
from tqdm import tqdm


def read_jsonl(path: Path) -> Iterable[dict]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def flatten_texts(records: Iterable[dict]) -> List[str]:
    texts: List[str] = []
    for rec in records:
        for key in ("q1", "q2", "q3"):
            q = rec.get(key) or {}
            text = (q.get("answer") or "").strip()
            if text:
                texts.append(text)
    return texts


def batch(items: List[str], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify texts via FastAPI server in batches")
    parser.add_argument("--server", type=str, default="http://127.0.0.1:8000", help="Server base URL")
    parser.add_argument("--input", type=str, required=True, help="Input JSONL (generated QA)")
    parser.add_argument("--output", type=str, default="ai/backend/data/political_qa_classified_via_api.jsonl", help="Output JSONL")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size for API calls")
    parser.add_argument("--max-length", type=int, default=256, help="Tokenizer max length on server")
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    records = list(read_jsonl(in_path))
    texts = flatten_texts(records)
    if not texts:
        print("No texts found.")
        return

    with out_path.open("w", encoding="utf-8") as f:
        for chunk in tqdm(list(batch(texts, args.batch_size)), desc="Classifying via API"):
            payload = {"texts": chunk, "max_length": args.max_length}
            resp = requests.post(f"{args.server}/classify", json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            for text, res in zip(chunk, results):
                row = {"text": text, **res}
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote: {out_path}")


if __name__ == "__main__":
    main()


