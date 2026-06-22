#!/usr/bin/env python3
"""Render index.html with default_value + preview_values from the schema -> index-preview.html."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SCHEMA = json.loads((ROOT / "placeholders-schema.json").read_text(encoding="utf-8"))


def get_dotted(ctx, key):
    parts = key.split(".")
    cur = ctx
    for p in parts:
        if isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
        if cur is None:
            return None
    return cur


# Build value map
values = {}
for f in SCHEMA["fields"]:
    key = f["key"]
    val = f.get("default_value") or ""
    values[key] = val

# preview_values overrides
preview = SCHEMA.get("preview_values", {})
for k, v in preview.items():
    values[k] = v


def render(template, ctx):
    # 1) Loops
    def render_each(m):
        list_key = m.group(1).strip()
        body = m.group(2)
        items = ctx.get(list_key)
        if not isinstance(items, list):
            return ""
        out = []
        for idx, item in enumerate(items, 1):
            sub_ctx = dict(ctx)
            sub_ctx["this"] = item
            sub_ctx["@index"] = idx
            rendered = render(body, sub_ctx)
            out.append(rendered)
        return "".join(out)

    template = re.sub(
        r"\{\{#each\s+([\w]+)\s*\}\}(.*?)\{\{/each\}\}",
        render_each,
        template,
        flags=re.DOTALL,
    )

    # 2) #if and #unless (iterate to handle nested)
    def render_if(m, negate=False):
        cond = m.group(1).strip()
        body = m.group(2)
        truthy = False
        if "=" in cond:
            key, val = cond.split("=", 1)
            v = get_dotted(ctx, key.strip())
            truthy = str(v if v is not None else "").strip() == val.strip()
        else:
            v = get_dotted(ctx, cond)
            truthy = bool(v) and str(v).lower() not in ("false", "0")
        if negate:
            truthy = not truthy
        return body if truthy else ""

    prev = None
    while prev != template:
        prev = template
        template = re.sub(
            r"\{\{#if\s+([^}]+)\}\}((?:(?!\{\{#if|\{\{#unless).)*?)\{\{/if\}\}",
            lambda m: render_if(m, False),
            template,
            flags=re.DOTALL,
        )
        template = re.sub(
            r"\{\{#unless\s+([^}]+)\}\}((?:(?!\{\{#if|\{\{#unless).)*?)\{\{/unless\}\}",
            lambda m: render_if(m, True),
            template,
            flags=re.DOTALL,
        )

    # 3) Plain variables (incl this.x)
    def replace_var(m):
        key = m.group(1).strip()
        v = get_dotted(ctx, key)
        return str(v) if v is not None else ""

    template = re.sub(r"\{\{\s*([\w@.\-]+)\s*\}\}", replace_var, template)
    return template


out = render(HTML, values)
out_path = ROOT / "index-preview.html"
out_path.write_text(out, encoding="utf-8")
print(f"Rendered -> {out_path}")
print(f"Open with: open '{out_path}'")
