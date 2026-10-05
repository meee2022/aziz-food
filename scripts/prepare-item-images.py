from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "item-images"
OUT.mkdir(parents=True, exist_ok=True)

SHEETS = [
    Path(r"C:\Users\M\.codex\generated_images\01a0114a-bbc3-7210-a7af-b691aa9bc653\exec-b127a00f-4015-45e0-9b2f-e2863362d3c6.png"),
    Path(r"C:\Users\M\.codex\generated_images\01a0114a-bbc3-7210-a7af-b691aa9bc653\exec-0e4d802e-b67e-4b53-8795-ddd740a30216.png"),
    Path(r"C:\Users\M\.codex\generated_images\01a0114a-bbc3-7210-a7af-b691aa9bc653\exec-f9b2123d-eaf4-44f4-8fcf-464ebf986218.png"),
]

NAMES = [
    "rock-melon", "green-apple", "asparagus-small", "asparagus-jumbo", "avocado",
    "avocado-hass", "baby-potato", "baby-rocca", "baby-spinach", "banana",
    "basil", "beetroot", "blackberry", "blueberry", "broccoli",
    "carrot", "cauliflower", "celery", "chard", "cherry-tomato",
    "coriander", "cucumber", "curry-leaves", "dill", "eggplant",
    "english-parsley", "orange", "garlic", "garlic-bag", "ginger-box",
    "ginger", "green-bell-pepper", "green-chilli", "iceberg-lettuce-box", "iceberg-lettuce",
    "jalapeno", "kiwi", "okra", "leeks", "lemon",
    "lemongrass", "lime", "long-green-chilli", "bottle-gourd", "mandarin",
    "mango", "mint", "mushroom", "pakistani-potato", "parsley",
    "pineapple", "pomegranate", "pomegranate-box", "potato", "red-bell-pepper",
    "red-cabbage", "red-grapes", "red-onion", "red-radish", "red-apple",
    "romaine-lettuce", "rosemary", "spring-onion", "strawberry", "strawberry-punnet",
    "sweet-potato", "thyme", "tomato", "white-cabbage", "white-onion",
    "yellow-bell-pepper", "zucchini", "red-grapes-alt", "lemon-alt", "bottle-gourd-alt",
]

for sheet_no, sheet_path in enumerate(SHEETS):
    image = Image.open(sheet_path).convert("RGB")
    width, height = image.size
    for cell in range(25):
        row, col = divmod(cell, 5)
        left, right = round(col * width / 5), round((col + 1) * width / 5)
        top, bottom = round(row * height / 5), round((row + 1) * height / 5)
        # Remove the thin generated grid line, then normalize thumbnail dimensions.
        tile = image.crop((left + 2, top + 2, right - 2, bottom - 2)).resize((512, 512), Image.Resampling.LANCZOS)
        tile.save(OUT / f"{NAMES[sheet_no * 25 + cell]}.webp", "WEBP", quality=88, method=6)

print(f"Prepared {len(NAMES)} catalog images in {OUT}")
