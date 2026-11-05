# Arquitetura do cadastro facial

O cadastro facial é um terceiro processo, ao lado da API .NET e do Next.js. A API .NET não vê foto, não gera embedding e não decide `MATCHED`.

```text
Navegador
  câmera, instruções, progresso
  MediaPipe só para orientar ao vivo
        │
        ▼
Next.js  /api/faces/*          /api/*  (o resto)
        │                            │
        ▼                            ▼
Face service :5110            API .NET :5106
  detecção, qualidade,          alunos, turmas,
  embeddings, decisão           presença, mensalidade
        │
        ▼
SQLite  um perfil por aluno
        três embeddings (frente, esquerda, direita)
```

## Responsabilidades

O frontend (`front/src/components/FaceEnrollment.tsx`) cuida da câmera, do oval, das frases, do progresso e da espera de 800 ms. Ele pode antecipar “aproxime o rosto” ou “vire para a esquerda” com o Face Landmarker. Não calcula embedding e não escolhe a decisão.

O serviço (`face-service/`) valida de novo cada imagem, gera os vetores e compara. Se discordar do navegador, a captura não entra.

A tela do aluno é `/alunos/{id}/rosto`. A tela técnica, fora do menu, é `/demo/facial`. Ela mostra as três capturas, um trecho de cada embedding e o resultado de uma foto de grupo. Não é a experiência do aluno.

## Contrato

O navegador chama `/api/faces/...`. O route `front/src/app/api/faces/[...path]/route.ts` encaminha para `FACE_SERVICE_URL` (padrão `http://127.0.0.1:5110`) nos caminhos `/faces/...`. Um servidor da academia pode chamar o face service direto, com os mesmos caminhos, sem passar pelo Next.

| Método | Caminho | Efeito |
| --- | --- | --- |
| `POST` | `/faces/check` | Aceita ou recusa uma pose. Não grava |
| `POST` | `/faces/enroll` | Grava ou substitui o perfil. Exige as três poses |
| `DELETE` | `/faces/{student_id}` | Remove o perfil |
| `GET` | `/faces/{student_id}` | Metadados. `?embeddings=true` inclui os vetores |
| `POST` | `/faces/recognize` | Rostos da foto contra os candidatos |
| `POST` | `/faces/attendance` | Sugestão de chamada só com a lista da turma. Não grava presença |
| `GET` | `/faces/demo/samples` | Fotos de exemplo da biblioteca, não são alunos |
| `GET` | `/health` | Saúde do processo |

O `studentId` é o mesmo identificador do aluno na API .NET. O face service não consulta o Postgres e não exige que o aluno exista lá.

## Presença a partir da foto da turma

```text
Aluno → este enrollment → Face Profile
Treino → tela Presença da turma → Tirar foto
         → POST /faces/attendance
         com candidateStudentIds = alunos daquela lista
         e instructorStudentIds = quem pode dar aula e não está na lista
         → suggested / review / unknown / instructor
         → aluno não visto fica pending, não ausente
         → professor corrige e confirma
         → presença na API .NET
```

A tela é a chamada em `/presenca`. “Aplicar presenças sugeridas” só marca presença. Não desmarca ninguém. Salvar a folha ainda envia verdadeiro ou falso para a API .NET; a interface pede confirmação quando isso gravaria ausência de quem a foto não confirmou.

A avaliação desse fluxo está em `docs/CLASS_PHOTO_EVAL.md`. Sem um conjunto de fotos de treino autorizado e separado do cadastro, o relatório fica `incomplete`.

## O que fica de fora

Não há liveness. Não há histórico de enrollments além do perfil vigente. As fotos não são persistidas. O ambiente salvo do Cloud Agent ainda não sobe o face service; ele continua um processo à parte, descrito no README.
