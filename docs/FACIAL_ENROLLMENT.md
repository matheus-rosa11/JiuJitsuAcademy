# Cadastro facial guiado

O cadastro facial acontece no pré-cadastro do aluno. A tela pede para a pessoa posicionar o rosto e conduz três capturas sozinha. Não há botão de “tirar foto” em cada ângulo, e a interface não fala de embedding, detecção ou limiar.

O objetivo é montar um perfil com mais de uma vista do rosto, para o reconhecimento posterior em fotos reais de treino. Uma única foto frontal não é o desenho deste fluxo.

## Fluxo

1. O aluno preenche os dados e salva.
2. O sistema abre “Cadastrar meu rosto”.
3. O navegador pede permissão da câmera. “Começar” existe só para essa permissão.
4. A pessoa encaixa o rosto na área oval.
5. O serviço aceita a vista frontal, depois a esquerda, depois a direita.
6. O perfil é gravado e a tela mostra “Cadastro facial concluído!”.
7. O fluxo volta para a ficha do aluno.

“Fazer isso depois” deixa o aluno cadastrado sem rosto. A ficha oferece “Cadastrar meu rosto” de novo.

## Capturas

São três imagens, nesta ordem:

| Pose | Instrução | Quando captura |
| --- | --- | --- |
| `front` | “Olhe diretamente para a câmera” | Um rosto, centralizado, tamanho adequado, luz e nitidez mínimas, olhar quase de frente |
| `left` | “Agora vire lentamente o rosto para a esquerda” | O mesmo tipo de qualidade, com a cabeça de fato virada para a esquerda de quem está na câmera |
| `right` | “Agora vire lentamente o rosto para a direita” | Igual, para a direita |

Não há uma quarta etapa de aproximar ou afastar. A captura só dispara depois que a orientação pedida aparece. Esperar alguns segundos com o rosto ainda de frente não grava a vista lateral.

Cada etapa boa fica estável por cerca de 800 ms, mostra “Capturando...” e dispara sozinha. Entre etapas a tela diz “Perfeito!”. O aluno não vê um contador de fotos.

## O que torna uma captura válida

O navegador só orienta. Quem decide é o serviço Python, em `POST /faces/check` e de novo em `POST /faces/enroll`.

No cadastro, a captura é recusada quando:

- não há rosto, ou a confiança da detecção fica abaixo de 0,60;
- há mais de um rosto;
- o rosto ocupa menos de 18% ou mais de 78% do quadro;
- o centro do rosto sai de uma margem de 0,18 em torno do meio da imagem;
- a luminância média do recorte fica abaixo de 45 ou acima de 230;
- a variância do Laplaciano no recorte fica abaixo de 8 (imagem muito tremida ou apagada);
- a cabeça não está na pose pedida.

A pose vem do InsightFace, em graus: `pitch`, `yaw`, `roll`. Yaw negativo é a direita de quem está na câmera; yaw positivo é a esquerda. Isso foi conferido espelhando um rosto já virado.

| Pose | Yaw | Pitch | Roll |
| --- | --- | --- | --- |
| `front` | entre −12° e 12° | até 30° | até 35° |
| `left` | 15° ou mais | até 30° | até 35° |
| `right` | −15° ou menos | até 30° | até 35° |

Mensagens que o aluno pode ver:

- “Posicione seu rosto dentro do círculo”
- “Olhe diretamente para a câmera”
- “Agora vire lentamente o rosto para a esquerda”
- “Agora vire lentamente o rosto para a direita”
- “Aproxime um pouco o rosto”
- “Afaste um pouco o rosto”
- “Posicione seu rosto no centro”
- “Encontre um local mais iluminado”
- “Fique parado por um instante”
- “Apenas uma pessoa por vez”
- “Não conseguimos identificar seu rosto”
- “Perfeito!”
- “Cadastro facial concluído!”

Se o navegador acha que a pose está boa e o serviço discorda, vale a mensagem do serviço e a captura não entra.

## Embeddings

Cada captura aceita vira um vetor ArcFace de 512 dimensões, já normalizado (norma L2 ≈ 1), gerado pelo modelo `w600k_r50` do pacote `buffalo_l`. A foto em si não é gravada. Miniaturas vistas na tela técnica ficam só na sessão do navegador.

O perfil guarda os três vetores separados, com a pose, o yaw e os números de qualidade. Na comparação, a nota de um aluno é o **maior** cosseno entre o rosto da foto e os três vetores. A média dos três não é usada: misturar frente e lado no mesmo vetor piora os dois.

## Refazer ou apagar

`POST /faces/enroll` substitui o perfil daquele aluno. Desistir no meio de uma nova tentativa não apaga o perfil anterior, porque a troca só acontece quando as três poses passam.

`DELETE /faces/{student_id}` remove o perfil. Não há histórico de tentativas neste POC.

## Câmera e luz

Use a câmera frontal, com o rosto inteiro dentro da área oval, uma pessoa por vez. Luz de frente, sem janela forte atrás da cabeça. Segure o aparelho parado no momento da captura. O preview da câmera é espelhado; a imagem enviada ao serviço não é.

## Quando falha

- Permissão negada ou sem câmera: a tela explica e oferece “Fazer isso depois”. O aluno continua cadastrado.
- Serviço facial fora do ar: a ficha mostra “Cadastro facial indisponível no momento.” e o resto da ficha segue normal.
- Uma pose é recusada: a mesma etapa continua, com a orientação correspondente.
- Imagem ilegível ou grande demais: “Não conseguimos identificar seu rosto”.

## Reconhecimento da foto da turma

`POST /faces/recognize` recebe a foto e, se a chamada informar, só compara com os alunos daquela turma (`candidateStudentIds`). Lista vazia não compara com ninguém. Omitir o campo compara com todos os perfis gravados.

Para cada rosto detectado a resposta traz `MATCHED`, `REVIEW` ou `UNKNOWN`. O reconhecimento de grupo não exige rosto centralizado nem uma pose específica. Exige detecção com confiança de pelo menos 0,50.

Os limiares iniciais, ainda sem uma curva calibrada em fotos de tatame:

| Decisão | Cosseno | Uso |
| --- | --- | --- |
| `MATCHED` | ≥ 0,40 | Sugestão para o professor |
| `REVIEW` | ≥ 0,30 e < 0,40, ou dois `MATCHED` com diferença menor que 0,06 | O professor decide. Não marcar presença sozinho |
| `UNKNOWN` | < 0,30, ou sem candidatos | Sem aluno sugerido. `studentId` vem nulo |

Na foto de exemplo da biblioteca, o mesmo recorte comparado com o próprio perfil fica em torno de 0,98. Rostos de pessoas diferentes nessa foto ficam abaixo de 0,30.

## O que este POC não prova ainda

A foto de exemplo do InsightFace é uma foto de grupo com pessoas diferentes. O recorte da esquerda é o espelho de outra pessoa, não uma terceira vista do mesmo aluno. Os testes provam as travas de pose, a troca do perfil e que um rosto estranho não passa do limiar. Eles não medem, com a mesma pessoa, o quanto as três vistas melhoram uma foto de treino. Essa medida pede um conjunto em que a mesma identidade apareça de frente e de lado.

## Liveness

Reconhecimento facial não é prova de que a pessoa está viva na frente da câmera. `buffalo_l` e o Face Landmarker do MediaPipe não trazem detecção de ataque de apresentação. Virar a cabeça também não é anti-spoofing: um vídeo na tela pode repetir o gesto. Este POC não inventa essa proteção. O foco é a qualidade do cadastro e o contrato de reconhecimento.
