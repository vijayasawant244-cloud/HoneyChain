from llm import chat

print("Test 1: plain answer")
reply = chat([{"role": "user", "content": "Reply with just the word: ready"}])
print("  ->", reply.get("content"))

print("Test 2: tool calling")
tools = [{
    "type": "function",
    "function": {
        "name": "check_hive_health",
        "description": "Get the latest hive temperature and condition.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}]
reply = chat([{"role": "user", "content": "Is my hive healthy? Use the tool."}], tools=tools)
calls = reply.get("tool_calls")
print("  ->", "tool call received: " + calls[0]["function"]["name"] if calls else "NO tool call (the model answered in text)")