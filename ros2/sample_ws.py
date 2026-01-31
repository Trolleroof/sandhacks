import asyncio
import json
import websockets


async def sample():
    async with websockets.connect("ws://localhost:9090") as ws:
        for topic in ["/web/pose", "/web/path", "/web/pointcloud"]:
            await ws.send(json.dumps({"op": "subscribe", "topic": topic}))
        print("Subscribed to /web/pose, /web/path, /web/pointcloud")
        print("Waiting for data...\n")

        while True:
            msg = json.loads(await ws.recv())
            topic = msg.get("topic", "?")
            data = msg.get("msg", {}).get("data", "")
            label = topic.split("/")[-1]

            if topic == "/web/pointcloud":
                try:
                    pc = json.loads(data)
                    print(f"[pointcloud] {pc['width']}x{pc['height']} pts, frame={pc['frame_id']}, b64_len={len(pc['points_b64'])}")
                except Exception:
                    print("[pointcloud] (parse error)")
            else:
                print(f"[{label}] {data}")


asyncio.run(sample())
