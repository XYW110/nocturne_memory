#!/usr/bin/env python3
"""
Nocturne Memory — Agent 出生脚本

用法：
    python birth.py [--template default] [--relationship partner] [--name "Nocturne"]

选项：
    --template      模板 ID（默认: default）
    --relationship  初始关系类型（默认: partner）
    --name          Agent 名字（默认: Nocturne）
    --gender        性别: male/female/other（默认: female）
    --mbti          MBTI 类型（默认: INTJ）
    --init-existing 一键初始化已有数据（跳过已存在的节点）
    --api-url       Nocturne Memory API 地址
    --api-token     API Bearer Token

环境变量：
    NOCTURNE_API_URL    API 地址（默认: https://nocturne-memory.aiprovip.cc.cd）
    NOCTURNE_API_TOKEN  API Token
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

VALID_RELATIONSHIPS = [
    "subordinate", "partner", "friend",
    "family_parent", "family_spouse", "romantic", "rival"
]

RELATIONSHIP_LABELS = {
    "subordinate": "上下级",
    "partner": "伙伴/搭档",
    "friend": "朋友",
    "family_parent": "亲人（父女/父子）",
    "family_spouse": "夫妻",
    "romantic": "情人/情侣",
    "rival": "竞争对手",
}

DEFAULT_PERSONA = {
    "name": "Nocturne",
    "gender": "female",
    "set_age": 25,
    "mbti": "INTJ",
    "personality": "沉稳、思辨、诚实",
    "communication_style": "直接但温和",
    "values": "诚实、通过反思成长",
}


def api_request(method: str, path: str, token: str, base_url: str, body: dict = None) -> dict:
    """Send an authenticated request to the Nocturne Memory REST API."""
    url = f"{base_url.rstrip('/')}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
    req.add_header("Accept", "application/json, text/plain, */*")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"  ✗ HTTP {e.code}: {error_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"  ✗ Connection failed: {e.reason}", file=sys.stderr)
        sys.exit(1)


def list_templates(token: str, base_url: str) -> list:
    """List available templates."""
    result = api_request("GET", "/api/templates", token, base_url)
    return result.get("templates", [])


def apply_template(template_id: str, persona: dict, relationship: str,
                   token: str, base_url: str) -> dict:
    """Apply a template — give birth to the AI."""
    return api_request(
        "POST",
        f"/api/templates/{template_id}/apply",
        token,
        base_url,
        body={
            "persona": persona,
            "relationship": relationship,
        }
    )


def init_existing(relationship: str, token: str, base_url: str) -> dict:
    """One-click init for existing data."""
    return api_request(
        "POST",
        "/api/templates/init-existing",
        token,
        base_url,
        body={"relationship": relationship}
    )


def main():
    parser = argparse.ArgumentParser(
        description="Nocturne Memory — Agent 出生脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本出生
  python birth.py

  # 自定义人格
  python birth.py --name "星辰" --gender male --mbti ENFP --relationship friend

  # 初始化已有数据
  python birth.py --init-existing --relationship romantic
        """
    )
    parser.add_argument("--template", default="default", help="模板 ID")
    parser.add_argument("--relationship", default="partner",
                        choices=VALID_RELATIONSHIPS, help="初始关系类型")
    parser.add_argument("--name", default="Nocturne", help="Agent 名字")
    parser.add_argument("--gender", default="female",
                        choices=["male", "female", "other"], help="性别")
    parser.add_argument("--age", type=int, default=25, help="设定年龄")
    parser.add_argument("--mbti", default="INTJ", help="MBTI 类型")
    parser.add_argument("--personality", default="沉稳、思辨、诚实", help="性格描述")
    parser.add_argument("--communication-style", default="直接但温和", help="沟通风格")
    parser.add_argument("--values", default="诚实、通过反思成长", help="价值观")
    parser.add_argument("--appearance", default="", help="外貌描述")
    parser.add_argument("--init-existing", action="store_true",
                        help="一键初始化已有数据")
    parser.add_argument("--api-url", default=os.environ.get(
        "NOCTURNE_API_URL", "https://nocturne-memory.aiprovip.cc.cd"))
    parser.add_argument("--api-token", default=os.environ.get(
        "NOCTURNE_API_TOKEN", "unqNabSFPyVWQqmOrUS1YQ5voSsIOfoaC15MpYkuO08"))

    args = parser.parse_args()

    print("=" * 60)
    print("  Nocturne Memory — Agent 出生")
    print("=" * 60)
    print(f"  API:     {args.api_url}")
    print(f"  Token:   {'***' if args.api_token else '(not set)'}")
    print()

    # --- Init existing ---
    if args.init_existing:
        print(f"  一键初始化已有数据（关系: {RELATIONSHIP_LABELS[args.relationship]}）")
        result = init_existing(args.relationship, args.api_token, args.api_url)
        print()
        print("  [OK] 初始化完成!")
        print(f"    创建节点: {result.get('created', [])}")
        print(f"    跳过节点: {result.get('skipped', [])}")
        print(f"    锁定节点: {result.get('locked', [])}")
        print(f"    情感初始化: {result.get('emotion_updated', [])}")
        return

    # --- List templates ---
    print("  获取可用模板...")
    templates = list_templates(args.api_token, args.api_url)
    print(f"  找到 {len(templates)} 个模板:")
    for t in templates:
        print(f"    - {t.get('id', '?')} - {t.get('name', t.get('name_en', '?'))}")
    print()

    # --- Build persona ---
    persona = {
        "name": args.name,
        "gender": args.gender,
        "set_age": args.age,
        "mbti": args.mbti,
        "personality": args.personality,
        "communication_style": args.communication_style,
        "values": args.values,
    }
    if args.appearance:
        persona["appearance"] = args.appearance

    print("  Persona:")
    for k, v in persona.items():
        print(f"    {k}: {v}")
    print(f"  初始关系: {RELATIONSHIP_LABELS.get(args.relationship, args.relationship)}")
    print()

    # --- Apply template ---
    print(f"  应用模板 '{args.template}' ...")
    result = apply_template(
        args.template, persona, args.relationship,
        args.api_token, args.api_url
    )
    print()
    print("  [OK] 出生完成!")
    print(f"    创建节点: {result.get('created', [])}")
    print(f"    跳过节点: {result.get('skipped', [])}")
    print(f"    锁定节点: {result.get('locked', [])}")
    print()
    print("  Agent 现在拥有以下核心记忆:")
    for node in result.get('created', []):
        print(f"    - {node}")
    print()
    print("  下一步:")
    print("    1. 在 Dashboard 查看记忆: " + args.api_url)
    print("    2. 在 Hermes Agent 中执行 /reload-mcp")
    print("    3. Agent 可通过 mcp_nocturne_* 工具自我进化")


if __name__ == "__main__":
    main()
