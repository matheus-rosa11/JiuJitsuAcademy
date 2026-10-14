# Avaliação da foto coletiva

A pergunta que esta avaliação existe para responder:

> Em uma foto coletiva real do treino, quantos alunos o sistema identifica corretamente, quantas identificações erradas produz e quanto trabalho manual ainda sobra para o professor?

Reconhecer uma selfie, ou ver a API responder, não responde essa pergunta. Este repositório **não contém** um conjunto autorizado de fotos de treino separado do cadastro. Enquanto esse conjunto não for preparado e o comando abaixo não for executado, o status é `incomplete` e não há percentual de acerto para publicar.

## Como preparar os dados

Crie a pasta `eval/datasets/academia/` (ela fica de fora do Git, junto com `eval/reports/`):

```text
eval/datasets/academia/
  manifest.json
  enrollment/<studentId>/front.jpg
  enrollment/<studentId>/left.jpg
  enrollment/<studentId>/right.jpg
  images/<arquivo citado pelo manifest>
```

`studentId` é o mesmo identificador do aluno na academia.

Regras de separação:

- A foto de cadastro e a foto de prova são arquivos diferentes, tirados em momentos diferentes.
- O hash SHA-256 da foto de prova não pode ser igual ao de nenhum arquivo de enrollment. Se for, essa prova é excluída e o relatório diz `leaked`.
- Um recorte da foto de prova **não** é detectado pelo hash. Não cadastre um crop, um frame vizinho ou um espelho da imagem que vai ser avaliada. Isso produz um acerto artificial.
- Só entra na comparação “uma foto frontal” versus “três ângulos” o aluno que tem os três arquivos `front`, `left` e `right`. Quem tem só a frontal fica em `excludedFromComparison` e não entra em nenhum dos dois lados.
- Os dois lados usam os mesmos alunos e as mesmas fotos de prova. A diferença observada não tem teste de significância. Três ângulos não são tratados como melhores antes da medida.

Cada item de `manifest.json` descreve uma fotografia e a identidade verdadeira:

```json
{
  "images": [
    {
      "id": "adulto-2026-10-14",
      "file": "images/adulto-2026-10-14.jpg",
      "candidateStudentIds": ["id-ana", "id-bruno", "id-carla"],
      "faces": [
        { "studentId": "id-ana", "identifiable": true, "box": [120, 80, 260, 240] },
        { "studentId": "id-bruno", "identifiable": false, "note": "de costas" },
        { "studentId": null, "identifiable": false, "box": [400, 90, 520, 230], "note": "visitante" }
      ]
    }
  ]
}
```

`candidateStudentIds` é a lista esperada daquela aula. `faces` são as pessoas que realmente aparecem.

- `identifiable: true` e `studentId` preenchido: rosto conhecido e reconhecível. Se o sistema não confirmar essa pessoa automaticamente, é falso negativo.
- `identifiable: false`: a pessoa está na cena, mas não dá para exigir reconhecimento (de costas, encoberta, rosto pequeno, fora de foco). Isso não é falso negativo.
- Aluno da lista que não está em `faces` como identificável: presença pendente. Não é falso negativo e não é ausência.
- `box` é `[x1, y1, x2, y2]` em pixels da foto de prova. Com caixa em todo rosto identificável e em toda previsão, a contagem é por rosto (interseção sobre união de pelo menos 0,50). Sem isso, a contagem é por conjunto de identidades e `detectionMisses` fica nulo.

Use fotos do ambiente da academia: turma perto e longe, em pé e ajoelhada, luz boa e ruim, óculos, rosto parcial, rosto virado, gente de fora da turma, cadastro curto ou ruim. Não use só selfie frontal. Não use a foto `t1.jpg` do InsightFace como prova de sucesso: os testes automatizados recortam essa mesma imagem para o enrollment.

## Consentimento

Só entram imagens que a academia pode usar neste teste. Crianças exigem o consentimento de quem é responsável, além do cuidado de não publicar a foto. O dataset fica na máquina local. Não commitar `eval/datasets/` nem `eval/reports/`.

## Como executar

Com o ambiente do face service já instalado:

```bash
cd face-service
.venv/bin/python -m benchmark.run \
  --dataset ../eval/datasets/academia \
  --report ../eval/reports/latest.json
```

O processo termina com código 0 mesmo quando o status é `incomplete`, para que a falta de dados apareça no JSON em vez de ser confundida com uma falha de execução. Sem a pasta, sem manifest, sem enrollment ou com todas as provas vazadas, o modelo não é carregado.

## Métricas

Uma identificação automática é só o rosto com `role: suggested`. `review` é trabalho manual: não é verdadeiro positivo e não é falso positivo.

| Nome | Conta |
| --- | --- |
| Verdadeiro positivo (TP) | Rosto identificável associado automaticamente à pessoa certa |
| Falso positivo (FP) | Nome automático na pessoa errada, inclusive um desconhecido com nome de aluno |
| Falso negativo (FN) | Pessoa identificável que não foi confirmada automaticamente (não detectada, revisão, desconhecida ou nome errado) |

- Precisão = TP / (TP + FP). Nulo se TP + FP = 0. Não vira 100%.
- Recall = TP / (TP + FN). Nulo se TP + FN = 0.
- F1 = média harmônica de precisão e recall. Nulo se precisão ou recall for nulo. Se os dois são 0, o F1 é 0.
- `detectionMisses` conta só o subconjunto dos FN em que o detector não achou o rosto. Erro de nome com o rosto encontrado fica de fora. Se alguma imagem não tinha caixas, o total é nulo: não dá para separar detecção de identificação.
- `correctStudentRate` = alunos identificáveis com ao menos um rosto automático certo / pessoas identificáveis. Um rosto certo basta para sugerir presença.
- `wrongIdentificationRate` = FP / (TP + FP). Nulo sem identificações automáticas. Não é acurácia.
- `reviewRate` = rostos em revisão / rostos detectados.
- `pendingRate` = alunos da lista que não ficaram em sugestão nem em revisão / tamanho da lista.
- `elapsedMs` é o tempo de leitura de cada foto. O resumo traz a soma e a média.

O resumo soma as fotos (micro). Fotos excluídas não entram nas contas.

O status só sai de `incomplete` para `observed` com pelo menos 5 fotos pontuadas e 30 pessoas identificáveis. Abaixo disso o JSON pode até mostrar uma precisão alta num punhado de rostos; o campo `claim` diz que a amostra é pequena demais para responder a pergunta do treino. `observed` descreve aquele conjunto. Não é garantia para outra academia e não é um carimbo de “validado”.

## O que os testes automáticos cobrem

Os testes de fórmula não usam foto. Eles travam o tratamento de denominador zero, a revisão que não vira acerto, o nome errado que conta como FP e FN, e o vazamento quando o mesmo arquivo está no cadastro e na prova.

O teste de `POST /faces/attendance` só verifica o contrato: a lista da turma, pendência de quem não tem perfil, rosto desconhecido e a ausência de um status de falta. A imagem usada é a mesma de onde saem os recortes de cadastro. O resultado desse teste não entra no relatório.
