"""
Test InternVL3-2B locally with Gradio UI.
Supports image + text chat for document extraction testing.

Run:
    pip install torch transformers gradio torchvision pillow einops timm
    python3 apps/labeling-api/scripts/test-internvl3.py
"""
import torch
from PIL import Image
import torchvision.transforms as T
from torchvision.transforms.functional import InterpolationMode
from transformers import AutoTokenizer, AutoModel
import gradio as gr

# --------------------
# Image Preprocessing
# --------------------

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

def build_transform(input_size):
    return T.Compose([
        T.Lambda(lambda img: img.convert("RGB") if img.mode != "RGB" else img),
        T.Resize((input_size, input_size), interpolation=InterpolationMode.BICUBIC),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

def preprocess_single_image(pil_img, input_size=448):
    transform = build_transform(input_size)
    pil_img = pil_img.resize((input_size, input_size))
    return transform(pil_img).unsqueeze(0)

# --------------------
# Model Loading
# --------------------

model_path = "OpenGVLab/InternVL3-8B"
device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"

print(f"Loading InternVL3-2B on {device}...")

# Monkey-patch torch.linspace to survive meta-device context during model init.
# InternVL3's ViT code calls .item() on linspace results, which fails on meta tensors.
_orig_linspace = torch.linspace
def _safe_linspace(*args, **kwargs):
    try:
        t = _orig_linspace(*args, **kwargs)
        t.tolist()
        return t
    except (RuntimeError, NotImplementedError):
        kwargs['device'] = 'cpu'
        return _orig_linspace(*args, **kwargs)
torch.linspace = _safe_linspace

model = AutoModel.from_pretrained(
    model_path,
    torch_dtype=torch.bfloat16,
    use_flash_attn=False,
    trust_remote_code=True,
).eval()

torch.linspace = _orig_linspace

if device != "cpu":
    model = model.to(device)
    print(f"Moved model to {device}")

tokenizer = AutoTokenizer.from_pretrained(
    model_path,
    trust_remote_code=True,
    use_fast=False
)

print(f"Model loaded on {device}!")

# --------------------
# Chat
# --------------------

def chat_interface(query, image, history_pairs):
    import time
    if not query or not query.strip():
        return [(u, a) for u, a in (history_pairs or [])], history_pairs or []

    generation_config = {"max_new_tokens": 1024, "do_sample": False}

    pixel_values = None
    if image is not None:
        if not isinstance(image, Image.Image):
            image = Image.fromarray(image)
        try:
            pixel_values = preprocess_single_image(image, 448)
            pixel_values = pixel_values.to(torch.bfloat16).to(device)
            if "<image>" not in query:
                query = "<image>\n" + query
        except Exception as e:
            print(f"Error processing image: {e}")
            pixel_values = None

    try:
        t0 = time.time()
        print(f"Processing: '{query[:50]}' (image={'yes' if pixel_values is not None else 'no'})")
        response, updated_history = model.chat(
            tokenizer, pixel_values, query, generation_config,
            history=history_pairs, return_history=True
        )
        print(f"Done in {time.time()-t0:.1f}s: {response[:100]}")
    except Exception as e:
        print(f"Error: {e}")
        if history_pairs is None:
            history_pairs = []
        updated_history = history_pairs + [(query, f"Error: {e}")]
        response = f"Error: {e}"

    messages = []
    for u, a in updated_history:
        messages.append({"role": "user", "content": u})
        messages.append({"role": "assistant", "content": a})
    return messages, updated_history

def reset_history():
    return [], None

# --------------------
# Gradio UI
# --------------------

with gr.Blocks(title="InternVL3-2B Test") as demo:
    gr.Markdown("# InternVL3-2B - Document Extraction Test")
    gr.Markdown(f"Running on **{device}** | Model: **{model_path}**")

    chatbot = gr.Chatbot(label="Conversation", height=500)
    state = gr.State([])

    with gr.Row():
        txt = gr.Textbox(placeholder="שאל משהו על התמונה...", label="Message", scale=3)
        img_input = gr.Image(label="Upload Image", type="pil", scale=1)

    with gr.Row():
        send_btn = gr.Button("Send", variant="primary")
        reset_btn = gr.Button("Reset")

    send_btn.click(fn=chat_interface, inputs=[txt, img_input, state], outputs=[chatbot, state])
    txt.submit(fn=chat_interface, inputs=[txt, img_input, state], outputs=[chatbot, state])
    reset_btn.click(fn=reset_history, outputs=[chatbot, state])

if __name__ == "__main__":
    print("Starting Gradio UI at http://localhost:7860")
    demo.launch(server_name="0.0.0.0", server_port=7860)
