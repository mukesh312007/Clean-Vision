import os
import sys
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
ML_DIR = BASE_DIR / "ml"
MODEL_IN = ML_DIR / "cleanliness_model.h5"
ONNX_PATH = BASE_DIR / "server" / "model" / "cleanvision.onnx"

def main():
    print("============================================")
    print("   CleanVision - ONNX Verification")
    print("============================================\n")

    if not MODEL_IN.exists():
        print(f"[Error] original Keras model {MODEL_IN} not found.")
        sys.exit(1)
        
    if not ONNX_PATH.exists():
        print(f"[Error] Converted ONNX model {ONNX_PATH} not found.")
        sys.exit(1)

    try:
        import tensorflow as tf
        import onnxruntime as ort
    except ImportError as e:
        print(f"[Error] Missing library: {str(e)}")
        sys.exit(1)

    print("[Info] Loading original Keras model...")
    keras_model = tf.keras.models.load_model(str(MODEL_IN))
    
    print("[Info] Loading converted ONNX model...")
    ort_session = ort.InferenceSession(str(ONNX_PATH))

    # Generate dummy input: 1 image of 224x224x3 with values in range [0, 1] (or [-1, 1])
    np.random.seed(42)
    dummy_input = np.random.rand(1, 224, 224, 3).astype(np.float32)

    print("[Info] Running inference on Keras model...")
    keras_output = keras_model.predict(dummy_input)
    
    print("[Info] Running inference on ONNX model...")
    input_name = ort_session.get_inputs()[0].name
    ort_outputs = ort_session.run(None, {input_name: dummy_input})
    onnx_output = ort_outputs[0]

    print("\n[Info] Results comparison:")
    print(f"   Keras Output: {keras_output.flatten()}")
    print(f"   ONNX Output:  {onnx_output.flatten()}")
    
    diff = np.abs(keras_output - onnx_output)
    max_diff = np.max(diff)
    print(f"   Maximum absolute difference: {max_diff:.2e}")
    
    if max_diff < 1e-4:
        print("\n[Success] Verification SUCCESS! The models produce equivalent predictions.")
    else:
        print("\n[Error] Verification FAILED! The model predictions are not matching.")
        sys.exit(1)

if __name__ == "__main__":
    main()
