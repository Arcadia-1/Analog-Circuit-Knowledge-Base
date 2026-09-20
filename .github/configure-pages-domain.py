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
ZONE = "tokenzhang.com"
PAGES_TARGET = "ams-class.pages.dev"
API = "https://api.cloudflare.com/client/v4"
DOMAIN_ENDPOINT = f"{API}/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/domains"


def call(method: str, url: str, payload: dict | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        url,
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


domains = call("GET", DOMAIN_ENDPOINT).get("result", [])
current = next((item for item in domains if item.get("name") == DOMAIN), None)
if current:
    print(f"{DOMAIN} already attached ({current.get('status', 'status unavailable')})")
else:
    created = call("POST", DOMAIN_ENDPOINT, {"name": DOMAIN}).get("result", {})
    print(f"attached {DOMAIN} ({created.get('status', 'pending')})")

zones = call("GET", f"{API}/zones?name={ZONE}").get("result", [])
if len(zones) != 1:
    raise SystemExit(f"expected one Cloudflare zone named {ZONE}, found {len(zones)}")
zone_id = zones[0]["id"]
dns_endpoint = f"{API}/zones/{zone_id}/dns_records"
records = call("GET", f"{dns_endpoint}?name={DOMAIN}").get("result", [])
if records:
    record = records[0]
    if record.get("type") != "CNAME" or record.get("content") != PAGES_TARGET or not record.get("proxied"):
        raise SystemExit(f"{DOMAIN} exists but does not point to the proxied Pages target {PAGES_TARGET}")
    print(f"{DOMAIN} already points to {PAGES_TARGET}")
else:
    record = call("POST", dns_endpoint, {
        "type": "CNAME",
        "name": DOMAIN,
        "content": PAGES_TARGET,
        "proxied": True,
        "ttl": 1,
        "comment": "Circuits & Systems Classroom on Cloudflare Pages",
    }).get("result", {})
    print(f"created {record.get('name', DOMAIN)} CNAME to {record.get('content', PAGES_TARGET)}")
