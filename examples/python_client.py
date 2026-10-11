"""Drive the playground from Python: a greedy chaser written here against a scripted runner.

    python3 examples/python_client.py

Talks to `node bin/serve.js` over stdin/stdout (one JSON object per line). Swap `policy` for
your own model; `obs` has every ball's position (m) and velocity (m/s).
"""
import json
import os
import subprocess

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class Playground:
    def __init__(self):
        self.p = subprocess.Popen(["node", os.path.join(ROOT, "bin", "serve.js")], cwd=ROOT,
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

    def call(self, **req):
        self.p.stdin.write(json.dumps(req) + "\n")
        self.p.stdin.flush()
        rep = json.loads(self.p.stdout.readline())
        if not rep["ok"]:
            raise RuntimeError(rep["error"])
        return rep

    def reset(self, scenario):
        return self.call(cmd="reset", scenario=scenario)

    def step(self, keys, n=1):
        return self.call(cmd="step", keys=keys, n=n)

    def close(self):
        self.p.stdin.close()
        self.p.wait()


def policy(me, target):
    """Hold the keys pointing at the target. Returns a key string like 'UR'."""
    keys = ""
    if target["y"] < me["y"] - 0.02: keys += "U"
    if target["y"] > me["y"] + 0.02: keys += "D"
    if target["x"] < me["x"] - 0.02: keys += "L"
    if target["x"] > me["x"] + 0.02: keys += "R"
    return keys


if __name__ == "__main__":
    pg = Playground()
    for episode in range(3):
        rep = pg.reset({
            "seed": episode,
            "map": {"generate": {"seed": 7}},
            "balls": [
                {"id": "runner", "team": 2, "keys": "R40 DR30 D40 L60 UL30 U"},
                {"id": "chaser", "team": 1, "minDistance": 10},  # no bot: we drive it
            ],
        })
        state = rep["state"]
        for _ in range(60 * 30):  # 30 s max
            balls = state["balls"]
            rep = pg.step({"chaser": policy(balls["chaser"], balls["runner"])})
            state = rep["state"]
            if rep["tagged"]:
                break
        print(f"episode {episode}: {'tagged' if rep['tagged'] else 'no tag'} after {state['tick'] / 60:.2f} s")
    pg.close()
