import os
import sys
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
ML_DIR = BASE_DIR / "ml"
MODEL_IN = ML_DIR / "cleanliness_model.h5"
MODEL_OUT_DIR = BASE_DIR / "server" / "model"
ONNX_OUT = MODEL_OUT_DIR / "cleanvision.onnx"

def main():
    print("============================================")
    print("   CleanVision - H5 to ONNX Converter")
    print("============================================\n")

    # If cleanliness_model.h5 doesn't exist, check other options
    if not MODEL_IN.exists():
        print(f"[Error] Default model file {MODEL_IN} not found.")
        # Try to find cleanliness_model(1).h5 or cleanliness_model(2).h5
        options = list(ML_DIR.glob("cleanliness_model*.h5"))
        if not options:
            print("[Error] No cleanliness_model*.h5 files found in ml/ folder.")
            sys.exit(1)
        # Sort and take the first available one
        selected_model = options[0]
        print(f"[Info] Found fallback: {selected_model}")
    else:
        selected_model = MODEL_IN

    # Create target directory if it doesn't exist
    MODEL_OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[Info] Loading and converting: {selected_model}")
    print(f"[Info] Output destination:    {ONNX_OUT}")
    
    # Run tf2onnx converter command
    cmd = [
        sys.executable, "-m", "tf2onnx.convert",
        "--keras", str(selected_model),
        "--output", str(ONNX_OUT),
        "--opset", "13"
    ]
    
    print(f"[Info] Running command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)
        print("[Success] Conversion completed successfully!")
        
        # Write classes.json for the server, since this is a score-only model
        classes_path = MODEL_OUT_DIR / "classes.json"
        import json
        classes_info = {
            "classes": ["Cleanliness-Score"],
            "model_type": "mobilenetv2_classification",
            "model_version": "2.0",
            "input_size": 224
        }
        classes_path.write_text(json.dumps(classes_info, indent=2))
        print(f"[Info] Class config written to {classes_path}")
        
    except subprocess.CalledProcessError as e:
        print("[Error] Conversion failed!")
        print(e.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
