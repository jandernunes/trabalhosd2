import os
import sys

# Código gerado do proto (scripts/gerar_proto.*) fica em gen/python.
_GEN = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "gen", "python"))
if _GEN not in sys.path:
    sys.path.insert(0, _GEN)
