import urllib.request
import json

# ================= 配置区 =================
# ⚠️ 请务必把这里替换成你自己的智谱 API Key！
API_KEY = "9aa383ed88bc409583aad7b478c77ee7.xnAeaBZptaldV1em"  
MODEL_NAME = "glm-4-flash"
URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
# ==========================================

def test_api():
    print(f"正在测试模型: {MODEL_NAME} ...")
    print(f"请求地址: {URL}\n")
    
    # 准备请求头
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 准备请求体
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "user", "content": "你好，请用一句话介绍你自己。"}
        ],
        "temperature": 0.7
    }
    
    # 将字典转换为 JSON 字符串并编码为 bytes
    data = json.dumps(payload).encode('utf-8')
    
    # 创建请求对象
    req = urllib.request.Request(URL, data=data, headers=headers, method='POST')
    
    try:
        # 发送请求
        with urllib.request.urlopen(req, timeout=30) as response:
            print(f"🟢 HTTP 状态码: {response.status}")
            
            # 读取并解析返回的数据
            resp_data = json.loads(response.read().decode('utf-8'))
            
            print("✅ 测试成功！API 连接完全正常。")
            print("-" * 30)
            print(f"模型回复: {resp_data['choices'][0]['message']['content']}")
            print(f"消耗 Token: {resp_data['usage']['total_tokens']}")
            print("-" * 30)
            
    except urllib.error.HTTPError as e:
        # 捕获 HTTP 错误（如 401 密码错，404 找不到等）
        print(f"\n🔴 请求失败！HTTP 错误码: {e.code}")
        error_body = e.read().decode('utf-8')
        print(f"服务器返回的错误详情:\n{error_body}")
        
    except urllib.error.URLError as e:
        # 捕获网络错误（如断网、DNS解析失败）
        print(f"\n🔴 网络连接失败！")
        print(f"错误原因: {e.reason}")
        
    except Exception as e:
        # 捕获其他未知错误
        print(f"\n🔴 发生未知异常: {e}")

if __name__ == "__main__":
    test_api()