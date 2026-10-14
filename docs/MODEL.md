# Modelo facial

## Pacote

O serviço usa InsightFace 0.7.3, pacote `buffalo_l`, em CPU (`CPUExecutionProvider`, `ctx_id=-1`, detecção em 640×640).

| Arquivo | Papel |
| --- | --- |
| `det_10g.onnx` | Detecção do rosto e da caixa |
| `w600k_r50.onnx` | Embedding ArcFace, 512 dimensões |
| `1k3d68.onnx` | Marco 3D que preenche `face.pose` (pitch, yaw, roll, em graus) |
| `2d106det.onnx` | Marcos 2D, usados pelo alinhamento interno |
| `genderage.onnx` | Roda junto com o pacote e é ignorado. Idade e gênero não saem da API |

Os arquivos ficam em `~/.insightface/models/buffalo_l` depois do primeiro uso. Não entram no git.

## O que é guardado

Cada aluno tem um perfil ativo. Cada perfil tem três embeddings, um por pose (`front`, `left`, `right`). O vetor é o `normed_embedding` do ArcFace, float32, norma L2 próxima de 1. Cosseno entre dois vetores é o produto interno.

Não guardamos a fotografia. Guardar só a foto obrigaria o sistema principal a gerar embedding depois, que é justamente o que este serviço existe para evitar. Também não fazemos a média dos três vetores: a nota de um aluno é o maior cosseno entre as poses. A pose vencedora volta em `matchedPose`.

O SQLite (`FACE_DB`, padrão `face-service/data/faces.sqlite`) tem `profiles(student_id, updated_at)` e `samples(student_id, pose, embedding, det_score, yaw, quality_json)`. `POST /faces/enroll` apaga as amostras daquele aluno e grava as três novas. `DELETE /faces/{student_id}` apaga o perfil.

`GET /faces/{student_id}` devolve metadados e os 8 primeiros números de cada vetor. O vetor inteiro só vem com `?embeddings=true`, para a tela técnica.

## Pose

Yaw negativo: a pessoa virou para a direita dela. Yaw positivo: virou para a esquerda dela. A convenção foi checada espelhando um rosto na horizontal, o que inverte o sinal e mantém o módulo.

No cadastro, frente exige `|yaw| ≤ 12`, esquerda `yaw ≥ 15`, direita `yaw ≤ -15`, com `|pitch| ≤ 30` e `|roll| ≤ 35`.

## Decisão

Limiares iniciais, não uma curva ROC de fotos de tatame:

- `MATCHED` se o melhor cosseno é ≥ 0,40;
- `REVIEW` se está em [0,30, 0,40);
- `UNKNOWN` abaixo de 0,30, sem `studentId`;
- se os dois melhores `MATCHED` diferem por menos de 0,06, a decisão desce para `REVIEW`, `ambiguous` fica verdadeiro e o `studentId` continua sendo o melhor.

Na foto de exemplo do InsightFace, o mesmo recorte contra o próprio embedding fica perto de 0,98. O maior cosseno entre pessoas diferentes dessa foto, medido neste ambiente, fica perto de 0,21.

O navegador usa MediaPipe Face Landmarker só para a orientação ao vivo (um rosto, posição, tamanho aproximado, piscar, yaw estimado). Esse yaw pode ser ajustado (`MATRIX_YAW_SIGN` em `front/src/lib/faceGuide.ts`) se o sinal visto no navegador não bater com o InsightFace. O serviço Python continua sendo a autoridade.

## Liveness

Não há modelo de liveness neste POC. Ver `docs/FACIAL_ENROLLMENT.md`.
