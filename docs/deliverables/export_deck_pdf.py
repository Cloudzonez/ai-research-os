#!/usr/bin/env python3
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
HTML = ROOT / "research_ai_foundry_deck.html"
PDF = ROOT / "research_ai_foundry_deck.pdf"


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.goto(HTML.as_uri(), wait_until="networkidle")
        page.pdf(
            path=str(PDF),
            width="13.333in",
            height="7.5in",
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()


if __name__ == "__main__":
    main()
