#!/usr/bin/env python3
"""
快速测试 API Key 配置是否正确
"""

import os
import sys
import requests
import json

def test_anthropic():
    """测试 Anthropic API Key"""
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        print("❌ ANTHROPIC_API_KEY 未设置")
        return False

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=100,
            messages=[{'role': 'user', 'content': 'Say "OK" in one word.'}]
        )
        print(f"✅ Anthropic API Key 有效")
        return True
    except Exception as e:
        print(f"❌ Anthropic API Key 无效: {e}")
        return False


def test_tavily():
    """测试 Tavily API Key"""
    api_key = os.environ.get('TAVILY_API_KEY', '')
    if not api_key:
        print("❌ TAVILY_API_KEY 未设置")
        return False

    try:
        resp = requests.post(
            'https://api.tavily.com/search',
            json={
                'api_key': api_key,
                'query': 'AI technology',
                'search_depth': 'basic',
                'max_results': 1,
            },
            timeout=10
        )
        if resp.status_code == 200:
            print(f"✅ Tavily API Key 有效")
            return True
        else:
            print(f"❌ Tavily API Key 无效: HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Tavily API Key 无效: {e}")
        return False


def test_analyze_endpoint():
    """测试完整的分析端点"""
    try:
        resp = requests.post(
            'http://localhost:5000/api/analyze',
            json={'term': 'Mamba'},
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            if 'verdict' in data and 'term' in data:
                print(f"✅ 分析端点正常: {data.get('term')} -> {data.get('verdict')}")
                return True
        else:
            print(f"❌ 分析端点错误: HTTP {resp.status_code}")
            print(f"   响应: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ 无法连接到本地服务: {e}")
        print("   请确保服务已启动: python3 app.py")
        return False


if __name__ == '__main__':
    print("🔧 反 FOMO 配置测试\n")

    results = {
        'Anthropic': test_anthropic(),
        'Tavily': test_tavily(),
    }

    print("\n" + "="*50)
    print("API Key 测试结果:")
    for name, result in results.items():
        status = "✅" if result else "❌"
        print(f"{status} {name}")

    if all(results.values()):
        print("\n✅ 所有 API Key 配置正确！")
        print("\n现在可以启动服务:")
        print("  python3 app.py")
        print("\n然后测试分析端点:")
        print("  python3 test_api.py  # 再运行一次，选择测试分析")
        sys.exit(0)
    else:
        print("\n❌ 部分 API Key 配置有问题，请检查")
        sys.exit(1)
