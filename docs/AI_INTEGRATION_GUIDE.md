# Guia para o sistema principal de Jiu-Jitsu

O enrollment facial é realizado neste serviço. O sistema principal não deve implementar sua própria lógica de captura facial ou geração de embeddings. Ele deve utilizar o contrato desta aplicação.

Não é preciso ler o código do modelo para cadastrar um rosto, apagar um rosto ou interpretar uma foto da turma.

A base do face service é `FACE_SERVICE_URL` (em desenvolvimento, `http://127.0.0.1:5110`). Pelo navegador da academia, o mesmo contrato está em `/api/faces/...`, que o Next encaminha para esse serviço. Os caminhos abaixo são os do face service.

O identificador do aluno é o mesmo `id` já usado na API de alunos.

## Como cadastrar um rosto

A experiência prevista para o aluno é a tela guiada `/alunos/{id}/rosto`: câmera, três poses, captura automática. O sistema principal deve mandar a pessoa para essa tela, ou para um cliente que fale com este contrato. Não deve abrir a própria câmera para “gerar um embedding”.

Se outro cliente já tiver as três imagens, o cadastro é:

`POST /faces/enroll`

```json
{
  "studentId": "o-guid-do-aluno",
  "captures": [
    { "pose": "front", "imageBase64": "<jpeg em base64 ou data-url>" },
    { "pose": "left", "imageBase64": "<...>" },
    { "pose": "right", "imageBase64": "<...>" }
  ]
}
```

Resposta `201`: `studentId`, `updatedAt` e, para cada pose, `accepted`, `detScore`, `yaw` e `quality`. A foto não fica armazenada. Um novo `POST` substitui o perfil anterior. Se o `POST` falhar, o perfil antigo continua valendo.

`POST /faces/check` com `{ "pose", "imageBase64" }` só valida uma imagem. Use isso para dar retorno durante a captura. Não grava nada.

Erros vêm como `{ "message", "code", "pose?" }` com HTTP 422. `message` já está em português e pode ser mostrada à pessoa. `code` é para o programa (`no_face`, `not_left`, `incomplete`, ...).

## Como remover um rosto

`DELETE /faces/{student_id}`

Resposta `204` quando havia perfil. `404` quando não havia. Não existe lista de tentativas antigas.

## Como reconhecer uma foto

`POST /faces/recognize`

```json
{
  "imageBase64": "<foto da turma>",
  "candidateStudentIds": ["id-da-turma-1", "id-da-turma-2"]
}
```

`candidateStudentIds` restringe a comparação aos alunos daquela turma.

- Campo ausente ou `null`: compara com todos os perfis cadastrados.
- Lista vazia: não compara com ninguém. Todo rosto volta `UNKNOWN`. É o caso de uma turma sem alunos.

A resposta tem um item em `faces` para cada rosto detectado:

```json
{
  "box": [0, 0, 10, 10],
  "decision": "MATCHED",
  "studentId": "id-da-turma-1",
  "score": 0.94,
  "matchedPose": "front",
  "ambiguous": false,
  "candidates": []
}
```

`score` é o melhor cosseno daquele aluno entre as três poses. `matchedPose` diz qual pose ganhou. `box` está na coordenada da imagem enviada.

## Como interpretar MATCHED

O melhor aluno da turma ficou com cosseno ≥ 0,40 e não houve outro aluno perto o suficiente para confundir.

Use como **sugestão** de presença. O professor confirma. O sistema principal não marca a chamada sozinho.

## Como interpretar REVIEW

Duas situações caem aqui:

- o melhor cosseno está entre 0,30 e 0,40;
- dois alunos ficaram ambos em faixa de `MATCHED` e a diferença é menor que 0,06. Nesse caso `ambiguous` é `true` e `studentId` ainda é o melhor, para o professor comparar.

Mostre a sugestão como dúvida. Não marque presença.

## Como interpretar UNKNOWN

O melhor cosseno ficou abaixo de 0,30, ou não havia candidatos. `studentId` e `matchedPose` vêm `null`. Não sugira um aluno. Pode ser visitante, rosto ruim ou alguém sem cadastro.

## Como lidar com baixa confiança

Baixa confiança é `REVIEW` ou `UNKNOWN`. Não rebaixe o limiar no sistema principal e não transforme `REVIEW` em presença “para não perder o aluno”. Se muitos rostos reais caem em `REVIEW`, o ajuste do limiar é deste serviço, em `face-service/app/decisions.py`, com fotos de treino — não um `if` no sistema da academia.

O cadastro pode ser refeito com outro `POST /faces/enroll` quando a foto de treino falha por um perfil ruim (luz, óculos, só uma vista). Isso não exige apagar antes.

## Como restringir candidatos à turma

Passe em `candidateStudentIds` somente os alunos da turma daquela aula. Um rosto de outra turma não deve aparecer como sugestão. Sem essa lista, o serviço considera a academia inteira.

## O que não fazer

- Não rodar InsightFace, MediaPipe ou outro modelo de embedding no sistema principal.
- Não guardar uma foto de perfil e “reconhecer depois” com outra biblioteca.
- Não tratar o giro da cabeça como prova de vida. Este serviço não faz anti-spoofing.
- Não marcar presença em `REVIEW` ou `UNKNOWN`.
