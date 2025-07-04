import openai

def generate_images_with_dalle(keywords, api_key, size="1024x1024", num_images=1, model="dall-e-3"):
    """
    Generate images using DALL-E API. Returns a list of image URLs.
    """
    if isinstance(keywords, list):
        prompt = " ".join([k for k in keywords if k.strip()])
    else:
        prompt = str(keywords).strip()

    if not prompt:
        raise ValueError("Prompt (keywords) must not be empty.")

    openai.api_key = api_key
    images = []
    for _ in range(num_images):
        response = openai.images.generate(
            model=model,
            prompt=prompt,
            size=size,
            n=1,  # Always 1 for DALL-E 3
        )
        images.append(response.data[0].url)
    return images