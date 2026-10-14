"""User-facing sentences. The UI shows these as-is and never mentions model internals."""

MESSAGES = {
    "no_face": "Não conseguimos identificar seu rosto",
    "multiple": "Apenas uma pessoa por vez",
    "too_small": "Aproxime um pouco o rosto",
    "too_large": "Afaste um pouco o rosto",
    "off_center": "Posicione seu rosto no centro",
    "dark": "Encontre um local mais iluminado",
    "bright": "Encontre um local mais iluminado",
    "blurry": "Fique parado por um instante",
    "not_front": "Olhe diretamente para a câmera",
    "not_left": "Agora vire lentamente o rosto para a esquerda",
    "not_right": "Agora vire lentamente o rosto para a direita",
    "bad_image": "Não conseguimos identificar seu rosto",
    "incomplete": "Ainda faltam as três posições do rosto",
}


def message_for(code: str) -> str:
    return MESSAGES.get(code, "Não conseguimos identificar seu rosto")
