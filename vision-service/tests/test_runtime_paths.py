"""Check startup path selection without importing the app or reading environment files.

Run: python -B -m unittest discover -s tests -p test_runtime_paths.py -v
"""

import ast
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


APP = Path(__file__).resolve().parents[1] / "app"
MODEL = "best_bushfire_multitask.pt"


def config_namespace(filename, repository, configured=""):
    tree = ast.parse((APP / filename).read_text(encoding="utf-8"))
    nodes = []
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id in {"_REPO_ROOT", "_PROJECT_ROOT"}
            for target in node.targets
        ):
            nodes.append(node)
        elif isinstance(node, ast.Expr) and isinstance(node.value, ast.Call) and isinstance(
            node.value.func, ast.Name
        ) and node.value.func.id == "load_dotenv":
            nodes.append(node)
        elif isinstance(node, ast.FunctionDef) and node.name == "_default_model_path":
            nodes.append(node)
    calls = []
    def getenv(name, default=""):
        assert name == "MODEL_PATH", "Only dummy model configuration may be read."
        return configured
    namespace = {
        "Path": Path,
        "__file__": str(repository / "vision-service" / "app" / filename),
        "load_dotenv": lambda *args: calls.append(args),
        "os": SimpleNamespace(getenv=getenv),
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), filename, "exec"), namespace)
    return namespace, calls


class RuntimePathTests(unittest.TestCase):
    def test_both_modules_use_repository_parent_then_default_without_reading_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve() / "repo"
            for filename in ("main.py", "chat.py"):
                with self.subTest(filename=filename):
                    namespace, calls = config_namespace(filename, repo)
                    self.assertEqual(namespace["_REPO_ROOT"], repo)
                    self.assertEqual(calls, [(repo / ".env",), (repo.parent / ".env",), ()])

    def test_model_precedence_and_fallbacks_use_existing_files_only(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve() / "repo"
            (repo / "models").mkdir(parents=True)
            configured = Path(directory).resolve() / "custom.pt"
            paths = [configured, repo / MODEL, repo.parent / MODEL, repo / "models" / MODEL]
            for path in paths:
                path.write_bytes(b"dummy test weights")
            namespace, _ = config_namespace("main.py", repo, str(configured))
            choose = namespace["_default_model_path"]
            for path in paths:
                self.assertEqual(choose(), path)
                path.unlink()
            self.assertEqual(choose(), repo.parent / MODEL)

    def test_blank_override_or_directory_does_not_mask_the_repository_model(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve() / "repo"
            repo.mkdir()
            (repo / MODEL).write_bytes(b"dummy test weights")
            for value in ("", " ", str(repo)):
                with self.subTest(value=value):
                    namespace, _ = config_namespace("main.py", repo, value)
                    self.assertEqual(namespace["_default_model_path"](), repo / MODEL)


if __name__ == "__main__":
    unittest.main()
