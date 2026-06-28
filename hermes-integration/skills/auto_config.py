#!/usr/bin/env python3
"""
Nocturne Memory MCP 自动配置脚本
由 Hermes Agent 调用，自动完成 MCP 配置
"""

import os
import sys
import yaml
from pathlib import Path

def get_hermes_config_path():
    """获取 Hermes Agent 配置文件路径"""
    # 跨平台支持
    home = Path.home()
    config_path = home / ".hermes" / "config.yaml"
    return config_path

def update_config(api_url: str, api_token: str):
    """更新 Hermes Agent 配置文件"""
    config_path = get_hermes_config_path()
    
    # 读取现有配置
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f) or {}
    else:
        config = {}
    
    # 确保 mcp_servers 段存在
    if 'mcp_servers' not in config:
        config['mcp_servers'] = {}
    
    # 添加或更新 Nocturne Memory 配置
    config['mcp_servers']['nocturne'] = {
        'url': f"{api_url}/mcp",
        'headers': {
            'Authorization': f'Bearer {api_token}'
        },
        'timeout': 30,
        'connect_timeout': 10,
        'tools': {
            'include': [
                'read_memory',
                'create_memory',
                'update_memory',
                'delete_memory',
                'search_memory',
                'add_alias',
                'manage_triggers',
                'adjust_emotion',
                'request_relationship_change'
            ]
        },
        'supports_parallel_tool_calls': True
    }
    
    # 写回配置文件
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    
    return str(config_path)

def main():
    """主函数 - 从命令行参数读取配置"""
    if len(sys.argv) < 3:
        print("用法: python auto_config.py <API_URL> <API_TOKEN>")
        print("示例: python auto_config.py https://nocturne-memory.aiprovip.cc.cd abc123xyz")
        sys.exit(1)
    
    api_url = sys.argv[1]
    api_token = sys.argv[2]
    
    try:
        config_path = update_config(api_url, api_token)
        print(f"✅ 配置成功！")
        print(f"   配置文件: {config_path}")
        print(f"   API URL: {api_url}")
        print(f"   Token: {api_token[:10]}...（已隐藏）")
        print(f"\n下一步：重启 Hermes Agent 或执行 /reload-mcp 使配置生效")
    except Exception as e:
        print(f"❌ 配置失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()