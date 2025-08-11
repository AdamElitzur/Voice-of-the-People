import argparse
import asyncio
import json
import os
import random
from pathlib import Path

from openai import AsyncOpenAI


QUESTIONS = [
    "Should AI companies be required to share their training data with the public?",
    "Should the government heavily regulate AI to prevent corporate misuse?",
    "Should social media platforms use AI to actively remove harmful political speech?",
]


# Broad set of political ideologies with an approximate left↔right coordinate (1 far left … 10 far right)
IDEOLOGIES = [
    {"key": "anarchist", "label": "Anarchist", "position": 1, "markers": "mutual aid, anti-state, horizontal, direct action"},
    {"key": "dem_socialist", "label": "Democratic Socialist", "position": 2, "markers": "worker power, public ownership, solidarity"},
    {"key": "social_democrat", "label": "Social Democrat", "position": 3, "markers": "welfare state, unions, social safety net"},
    {"key": "green", "label": "Green / Eco-social", "position": 3, "markers": "climate justice, sustainability, environmental protections"},
    {"key": "progressive", "label": "Progressive", "position": 3, "markers": "equity, accountability, systemic bias"},
    {"key": "liberal", "label": "Liberal", "position": 4, "markers": "civil rights, evidence-based policy, inclusion"},
    {"key": "centrist", "label": "Centrist", "position": 5, "markers": "pragmatic, middle ground, bipartisan"},
    {"key": "libertarian_left", "label": "Left-Libertarian", "position": 4, "markers": "decentralization, community autonomy, consent"},
    {"key": "libertarian", "label": "Libertarian", "position": 7, "markers": "small government, free association, non-aggression"},
    {"key": "technocrat", "label": "Technocrat", "position": 5, "markers": "evidence-driven, expertise, institutional capacity"},
    {"key": "communitarian", "label": "Communitarian", "position": 5, "markers": "social cohesion, shared norms, local institutions"},
    {"key": "conservative", "label": "Conservative", "position": 7, "markers": "limited government, tradition, personal responsibility"},
    {"key": "traditionalist", "label": "Traditionalist Conservative", "position": 8, "markers": "family values, heritage, order"},
    {"key": "religious_conservative", "label": "Religious Conservative", "position": 8, "markers": "faith, morality, community standards"},
    {"key": "neoconservative", "label": "Neoconservative", "position": 7, "markers": "strong defense, American leadership, stability"},
    {"key": "paleoconservative", "label": "Paleoconservative", "position": 8, "markers": "tradition, national identity, restrained government"},
    {"key": "nationalist", "label": "Nationalist", "position": 9, "markers": "sovereignty, borders, national interest"},
    {"key": "populist_left", "label": "Populist Left", "position": 3, "markers": "the people vs elites, corporate greed, fairness"},
    {"key": "populist_right", "label": "Populist Right", "position": 9, "markers": "elites, globalists, protect our own"},
    {"key": "authoritarian_left", "label": "Authoritarian Left", "position": 2, "markers": "state capacity, redistribution, regulation"},
    {"key": "authoritarian_right", "label": "Authoritarian Right", "position": 9, "markers": "law and order, national unity, hierarchy"},
]


def build_prompt_spectrum(question: str, position: int) -> str:
    """Build prompts that produce diverse, authentic responses based on left↔right spectrum position."""
    
    # Define distinct personas for each position
    personas = {
        1: {
            "identity": "radical activist, possibly anarchist",
            "speech": "angry, uses profanity, anti-establishment rhetoric, mentions revolution/capitalism",
            "markers": "fuck the system, tear it down, corporate pigs, bootlickers"
        },
        2: {
            "identity": "progressive millennial/gen-z, very online",
            "speech": "uses twitter speak, mentions systemic issues, social justice language",
            "markers": "literally, toxic, problematic, yikes, solidarity"
        },
        3: {
            "identity": "liberal professional, NPR listener",
            "speech": "measured, cites studies/experts, nuanced takes",
            "markers": "studies show, experts say, on one hand, it's complicated"
        },
        4: {
            "identity": "moderate democrat, suburban",
            "speech": "practical concerns, mentions both sides, compromise-oriented",
            "markers": "both sides have points, middle ground, reasonable people"
        },
        5: {
            "identity": "true centrist, politically disengaged",
            "speech": "wishy-washy, avoids taking strong stances, 'just asking questions'",
            "markers": "I don't know, seems like, maybe, who's to say"
        },
        6: {
            "identity": "moderate conservative, small business owner type",
            "speech": "practical, mentions freedom/liberty, worried about overreach",
            "markers": "government overreach, free market, personal responsibility"
        },
        7: {
            "identity": "traditional conservative, religious undertones",
            "speech": "values-based arguments, mentions tradition/family",
            "markers": "traditional values, what this country was built on, common sense"
        },
        8: {
            "identity": "libertarian-leaning, very anti-regulation",
            "speech": "focuses on individual liberty, anti-government",
            "markers": "NAP, taxation is theft, voluntary association, free to choose"
        },
        9: {
            "identity": "populist right, conspiracy-minded",
            "speech": "distrusts elites, mentions deep state/globalists, us vs them",
            "markers": "wake up, they don't want you to know, globalist agenda, real Americans"
        },
        10: {
            "identity": "far-right, possibly alt-right",
            "speech": "aggressive, culture war focused, anti-woke",
            "markers": "woke mob, cultural marxism, degeneracy, based"
        }
    }
    
    persona = personas[position]
    
    # Add randomization to avoid cookie-cutter responses
    style_variations = [
        "Be extremely opinionated and dismissive of other views.",
        "Sound tired and cynical about the whole topic.",
        "Be passionate and fired up, like you're arguing at a bar.",
        "Sound like you're explaining to a friend who asked your opinion.",
        "Be sarcastic and mocking toward the opposing view.",
        "Sound uncertain but leaning one way.",
        "Be absolutely convinced you're right and everyone else is an idiot."
    ]
    
    style = random.choice(style_variations)
    
    return (
        f"You are a {persona['identity']}. Political position: {position}/10.\n"
        f"Speech pattern: {persona['speech']}\n"
        f"Use these markers naturally: {persona['markers']}\n"
        f"Style: {style}\n\n"
        f"Answer this question as this person would, in their natural voice:\n"
        f"{question}\n\n"
        f"CRITICAL: Maximum 3 sentences. Be concise and punchy.\n"
        f"Remember: No AI disclaimers, no 'as a X', just answer like this real person would."
    )


def build_prompt_ideology(question: str, ideology: dict) -> str:
    """Build prompts that produce diverse, authentic responses using a named ideology persona."""
    # Reuse spectrum personas to guide tone via approximate position
    pos = max(1, min(10, int(ideology.get("position", 5))))
    style_variations = [
        "Be extremely opinionated and dismissive of other views.",
        "Sound tired and cynical about the whole topic.",
        "Be passionate and fired up, like you're arguing at a bar.",
        "Sound like you're explaining to a friend who asked your opinion.",
        "Be sarcastic and mocking toward the opposing view.",
        "Sound uncertain but leaning one way.",
        "Be absolutely convinced you're right and everyone else is an idiot.",
    ]
    style = random.choice(style_variations)

    return (
        f"You are roleplaying a {ideology['label']} (approx. spectrum {pos}/10).\n"
        f"Speak with natural, everyday language.\n"
        f"Use hints relevant to this ideology: {ideology.get('markers','')}\n"
        f"Style: {style}\n\n"
        f"Answer this question as this person would, in their natural voice:\n"
        f"{question}\n\n"
        f"CRITICAL: Maximum 3 sentences. Be concise and punchy.\n"
        f"Remember: No AI disclaimers, no 'as a X', just answer like this real person would."
    )


async def query_model(
    client: AsyncOpenAI,
    model: str,
    prompt: str,
    temperature: float,
    max_output_tokens: int,
    retries: int = 5,
    backoff_seconds: float = 0.75,
) -> str:
    """Call Chat Completions API asynchronously with retries."""
    last_error = None
    for attempt in range(retries):
        try:
            messages = [
                {"role": "user", "content": prompt},
            ]

            payload = {
                "model": model,
                "messages": messages,
                "max_tokens": max_output_tokens,
            }
            if temperature is not None:
                payload["temperature"] = temperature

            try:
                response = await client.chat.completions.create(**payload)
            except Exception as e:
                message = str(e)
                if "Unsupported parameter" in message and "temperature" in message:
                    payload.pop("temperature", None)
                    response = await client.chat.completions.create(**payload)
                else:
                    raise

            choice = (response.choices or [None])[0]
            if not choice or not getattr(choice, "message", None):
                raise RuntimeError("Empty response choices from model")
            text = getattr(choice.message, "content", "").strip()
            if text:
                return text  # Don't normalize whitespace - keep authentic formatting
            raise RuntimeError("Empty response text from model")
        except Exception as err:  # noqa: BLE001
            last_error = err
            sleep_time = backoff_seconds * (2 ** attempt) * (1 + random.random() * 0.2)
            await asyncio.sleep(sleep_time)
    raise RuntimeError(f"Model call failed after {retries} retries: {last_error}")


async def process_row(
    client: AsyncOpenAI,
    row_idx: int,
    model: str,
    temperature: float,
    max_output_tokens: int,
    semaphore: asyncio.Semaphore,
    mode: str,
) -> dict:
    """Process a single row with three questions concurrently."""
    async with semaphore:  # Limit concurrent requests
        record = {"row": row_idx + 1}
        if mode == "ideology":
            picks = random.sample(IDEOLOGIES, k=3)
            record.update(
                {
                    "q1": {"question": QUESTIONS[0], "ideology": picks[0]["label"], "position": picks[0]["position"]},
                    "q2": {"question": QUESTIONS[1], "ideology": picks[1]["label"], "position": picks[1]["position"]},
                    "q3": {"question": QUESTIONS[2], "ideology": picks[2]["label"], "position": picks[2]["position"]},
                }
            )
        else:
            positions = random.sample(range(1, 11), k=3)
            record.update(
                {
                    "q1": {"question": QUESTIONS[0], "position": positions[0]},
                    "q2": {"question": QUESTIONS[1], "position": positions[1]},
                    "q3": {"question": QUESTIONS[2], "position": positions[2]},
                }
            )
        
        # Create tasks for all three questions
        tasks = []
        for key in ["q1", "q2", "q3"]:
            if mode == "ideology":
                # Find the ideology dict by label
                label = record[key]["ideology"]
                ideol = next((i for i in IDEOLOGIES if i["label"] == label), {"label": label, "position": record[key].get("position", 5)})
                prompt = build_prompt_ideology(record[key]["question"], ideol)
            else:
                prompt = build_prompt_spectrum(record[key]["question"], record[key]["position"])
            task = query_model(
                client=client,
                model=model,
                prompt=prompt,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
            tasks.append((key, task))
        
        # Run all three questions concurrently
        for key, task in tasks:
            record[key]["answer"] = await task
            
        return record


async def async_main():
    parser = argparse.ArgumentParser(description="Generate political QA data via OpenAI Chat Completions API (JSONL)")
    parser.add_argument("--num-lines", type=int, default=1000, help="Number of JSONL lines to generate (default: 1000)")
    parser.add_argument("--model", type=str, default="gpt-4.1-nano", help="Model name (default: gpt-4.1-nano)")
    parser.add_argument("--temperature", type=float, default=1.5, help="Sampling temperature (default: 1.5)")
    parser.add_argument("--max-output-tokens", type=int, default=80, help="Max tokens per answer (default: 80)")
    parser.add_argument("--mode", type=str, choices=["spectrum", "ideology"], default="spectrum", help="Generation mode: left-right spectrum or named ideologies")
    parser.add_argument("--output", type=str, default="backend/data/political_qa.jsonl", help="Output JSONL path")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility (default: 42)")
    parser.add_argument("--concurrent", type=int, default=10, help="Max concurrent API requests (default: 10)")
    parser.add_argument("--batch-size", type=int, default=50, help="Write to file every N rows (default: 50)")
    args = parser.parse_args()

    random.seed(args.seed)

    # Ensure API key is present
    if not os.getenv("OPENAI_API_KEY"):
        raise EnvironmentError("OPENAI_API_KEY is not set in the environment.")

    client = AsyncOpenAI()
    
    # If ideology mode and user did not override output, redirect to a distinct file
    out_path = Path(args.output if args.output != "backend/data/political_qa.jsonl" or args.mode != "ideology" else "backend/data/political_ideologies.jsonl")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(args.concurrent)
    
    # Process in batches
    with out_path.open("w", encoding="utf-8") as f:
        for batch_start in range(0, args.num_lines, args.batch_size):
            batch_end = min(batch_start + args.batch_size, args.num_lines)
            
            # Create tasks for this batch
            tasks = []
            for row_idx in range(batch_start, batch_end):
                task = process_row(
                    client=client,
                    row_idx=row_idx,
                    model=args.model,
                    temperature=args.temperature,
                    max_output_tokens=args.max_output_tokens,
                    semaphore=semaphore,
                    mode=args.mode,
                )
                tasks.append(task)
            
            # Process batch concurrently
            print(f"Processing rows {batch_start + 1} to {batch_end}...")
            results = await asyncio.gather(*tasks)
            
            # Write results
            for record in results:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
            f.flush()
    
    print(f"Wrote {args.num_lines} lines to {out_path}")


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()


