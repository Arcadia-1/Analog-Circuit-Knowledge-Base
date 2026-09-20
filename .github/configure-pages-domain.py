#!/usr/bin/env python3
"""Attach the public tutorial hostname to the existing Cloudflare Pages project."""

import json
import os
import urllib.error
import urllib.request


ACCOUNT_ID = os.environ["CLOUDFLARE_ACCOUNT_ID"]
API_TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
PROJECT = "ams-class"
DOMAIN = "circuits-and-systems.tokenzhang.com"
ENDPOINT = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/domains"


def call(method: str, payload: dict[str, str] | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise SystemExit(f"Cloudflare domain API returned HTTP {error.code}: {detail}") from error
    if not result.get("success"):
        raise SystemExit(f"Cloudflare domain API failed: {result.get('errors', result)}")
    return result


domains = call("GET").get("result", [])
current = next((item for item in domains if item.get("name") == DOMAIN), None)
if current:
    print(f"{DOMAIN} already attached ({current.get('status', 'status unavailable')})")
else:
    created = call("POST", {"name": DOMAIN}).get("result", {})
    print(f"attached {DOMAIN} ({created.get('status', 'pending')})")
