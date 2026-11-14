# icevbooster — documento de design

Data: 14/11/2026 · Status: rascunho para aprovação

## 1. Intenção

Uma página web gratuita para alunos do ICEV (Teresina) que, a partir de prints do portal acadêmico, responde duas perguntas:

1. **Faltas:** quantas faltas ainda posso ter em cada matéria e, no modo "aproveitamento máximo", a partir de que data posso parar de ir a cada matéria (e a tudo) até o simulado sem reprovar por falta.
2. **Notas:** quanto preciso tirar nas provas que faltam (P2, simulado/P3, REC) para passar — em pontos e em número de acertos no simulado.

Mais uma **calculadora** para o aluno montar notas compostas (quizzes, trabalhos, prova) e um **calendário** que mostra, dia a dia, onde pode ou não faltar.

### Metas
- Enviar o print e ver o resultado, sem cadastro, sem custo, sem servidor.
- Resultados confiáveis: o aluno sempre vê e pode corrigir os dados lidos antes do cálculo.
- Visual "liquid glass", tema com as cores do ICEV, ótimo no celular.

### Não-metas (por enquanto)
- Outros modos de faltas além de "aproveitamento máximo".
- Contas, login, sincronização entre aparelhos, backend, IA paga.
- Integração direta com o portal (só prints).

### Anti-metas (seria um fracasso mesmo "funcionando")
- Dizer ao aluno que pode faltar e ele reprovar por falta. Em qualquer dúvida o cálculo é **conservador** (arredonda contra o aluno) e mostra as premissas.
- Parecer um site oficial do ICEV. Usar só as cores, não a logo; rodapé "ferramenta não oficial".
- Enviar os prints ou dados do aluno para qualquer servidor.

## 2. Restrições

- **Grátis:** site estático hospedado na **Vercel** (plano gratuito, sem funções serverless), sem backend, sem API paga.
- **Tudo roda no navegador:** OCR com Tesseract.js (idioma `por`), PDF com pdf.js.
- Dados do aluno ficam só no `localStorage` do aparelho (com botão "apagar meus dados").
- Precisa funcionar bem no celular (o aluno vai enviar prints pelo celular).
- Os prints são da **versão de computador** do portal (tabelas largas, como em `examples/`). A área de envio mostra um aviso: "tire o print com a tabela completa visível — todas as linhas e colunas". Não há suporte a layouts mobile do portal.

## 3. Abordagens consideradas

| | A) OCR no navegador (escolhida) | B) IA com visão via backend |
|---|---|---|
| Custo | zero | frações de centavo por print + hospedagem com backend |
| Privacidade | imagem não sai do aparelho | imagens vão para a API |
| Precisão | boa nos prints do portal; fraca no print do horário | alta em todos |
| Manutenção | regras por formato de print; quebram se o portal mudar | robusta a mudanças |

**Escolha do usuário: A**, porque precisa ser grátis. Mitigação: toda leitura vira uma tabela editável, e se o OCR do horário falhar o aluno preenche o horário manualmente a partir das matérias lidas no print de faltas.

## 4. Entradas (prints e dados)

Exemplos reais em `examples/`.

| Entrada | Obrigatória? | O que extrair | Exemplo |
|---|---|---|---|
| Print de **faltas** | sim (aba Faltas) | Disciplina, Turma, faltas por bimestre, **TOTAL FALTAS**, **Percentual** | `Screenshot 2026-11-14 151505.png` |
| Print do **histórico/período** | não | Disciplina, Código, Faltas, **CH** (36/72/100) | `Screenshot 2026-11-14 153848.png` |
| Print do **horário** | sim para o modo aproveitamento (ou preenchimento manual) | dia da semana × faixa (18:20–20:00 / 20:20–22:00) → disciplina | `Screenshot 2026-11-14 153714.png` |
| Print de **notas** | sim (aba Notas) | Disciplina, P1, P2, P3, Média semestral, REC final, Média final | `Screenshot 2026-11-14 151516.png` |
| **Data do simulado** | sim para o modo aproveitamento | digitada pelo aluno | — |
| **Calendário acadêmico do ICEV** (PDF) | não | dias sem aula (recessos, feriados institucionais) | *PDF ainda não recebido* |

### Regras de fonte
- **Faltas:** o print de faltas é a fonte da verdade. O histórico só fornece a CH.
- **Carga horária**, nesta ordem de prioridade:
  1. CH do print do histórico, se enviado;
  2. inferida do percentual: `CH = faltas ÷ (percentual/100)`, arredondada para 36 ou 72 (ex.: 4 faltas a 11,11% → 36h; 8 a 11,11% → 72h);
  3. Inglês e Projeto de Extensão: **sempre 36h**;
  4. o resto (ex.: matérias com 0 faltas) o aluno marca 36h/72h (ou digita outra CH, ex. 100h).
  O aluno sempre pode corrigir.
- **Estágio** (CH 100, faltas em branco): **sem tratamento especial** — faltas em branco = 0, CH vem do histórico ou do aluno, aulas por semana vêm do horário, e entra no cálculo como qualquer matéria. Em geral: o limite é sempre 25% da CH, e o número de aulas por semana sai do horário (não da CH).
- **Casamento de nomes** entre prints (ex.: "Proj. de Extensão VI" ↔ "Projeto de Extensão VI", "Gestão de Projetos" ↔ "Gestão de Projetos de Software"): busca aproximada; o aluno corrige o que não casar.
- **Matéria sem horário** (ex.: Inglês VI não aparece no print do horário) ou matéria do horário sem faltas (ex.: "Eletiva VI" × "Eletiva II"): aviso visível; a matéria fica fora do plano até o aluno resolver manualmente.

## 5. Faltas

### Regras do ICEV
- Cada aula dura 1h40 e **conta 2 faltas** (o portal conta em horas).
- **Limite: 25% da CH** → 36h = 9 faltas; 72h = 18 faltas.
- Matéria de 36h tem **1 aula por semana**; de 72h, **2 aulas por semana** (no mesmo dia, ex. Gestão de Projetos às quintas, ou em dias diferentes, ex. Pesquisa Operacional ter/qua).

### Saldo
- `saldoFaltas = limite − faltasUsadas`
- `saldoAulas = floor(saldoFaltas ÷ 2)` (conservador: 5 faltas = 2 aulas)
- Exemplo do print: Marketing (36h, 4) → 2 aulas; Pesquisa Operacional (72h, 8) → 5 aulas; Projeto de Extensão (36h, 2) → 3 aulas.

### Tabela da aba Faltas
Disciplina · CH · faltas usadas · percentual · saldo (em aulas e em faltas) · "parar a partir de" — editável (CH, faltas).

### Modo "aproveitamento máximo" (único modo por enquanto)
Objetivo: dizer, para cada matéria, a partir de que dia o aluno pode **parar de ir até o simulado**, e a partir de que dia pode faltar **tudo**.

- O **simulado é um dia só**, para todas as matérias. No dia do simulado ninguém leva falta; depois dele não há aula. Portanto a última aula que conta é a da **véspera** do simulado.
- Aulas que **não acontecem** não contam: fins de semana, feriados nacionais/estaduais/municipais e dias sem aula do calendário do ICEV.
- Algoritmo por matéria:
  1. Liste os **dias de aula** da matéria entre hoje e a véspera do simulado (excluindo dias sem aula). Cada dia tem um custo = nº de aulas da matéria naquele dia (1 ou 2).
  2. Percorra de trás para frente (do último dia para o primeiro), somando custos enquanto `soma ≤ saldoAulas`.
  3. **Um dia com 2 aulas só entra se houver saldo para as duas** (ex.: Gestão de Projetos na quinta). Se não houver, para ali — não se recomenda faltar só metade do dia.
  4. A data de início é o primeiro dia incluído → "pode parar de ir a partir de DD/MM". Se o saldo cobrir todos os dias restantes → "já pode parar".
  5. Saldo que sobrar (não cabe na sequência) aparece como "+N aulas de folga para usar quando quiser".
- **Destaque geral:** "Pode faltar tudo a partir de DD/MM" = a data **mais tardia** entre as matérias com saldo. Matérias sem saldo (ou sem saldo para nem um dia) ficam como exceção: "… exceto Eletiva II (sem saldo — vá a todas as terças)".
- Exemplo de validação (do usuário, em aulas): X com 10, Y com 2, Z com 6, uma aula de cada por semana, nesta ordem na semana, simulado na 10ª semana no dia de Y → X: falta as 10; Y: falta as semanas 8 e 9; Z (aulas nas semanas 1–9): falta a partir da semana 4.

### Feriados
Calculados automaticamente para o ano corrente; o calendário do ICEV tem prioridade (pode adicionar ou remover dias).
- Nacionais fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12.
- Móveis (a partir da Páscoa): Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi. *Quarta de Cinzas: aulas são à noite, então não é dia sem aula.*
- Piauí: 19/10 (Dia do Piauí), 13/03 (Batalha do Jenipapo) — **a confirmar**.
- Teresina: 16/08 (aniversário da cidade) — **a confirmar** demais feriados municipais.
- O aluno pode adicionar/remover dias sem aula manualmente.

### Calendário acadêmico do ICEV (PDF)
Upload do PDF → pdf.js extrai o texto → busca datas próximas de palavras como "feriado", "recesso", "sem aula", "simulado" → lista os dias encontrados para o aluno confirmar. **Formato exato pendente**: o usuário vai enviar um exemplo; as regras de leitura serão ajustadas a ele. Até lá, a entrada manual de dias sem aula cobre a necessidade.

## 6. Calendário

### Aba Calendário (completa)
- Grade mensal com navegação ‹ › e botão "Hoje".
- Filtro por matéria (Todas / cada matéria).
- Cores do dia:
  - **Branco** (normal): dia com aula que o aluno deve ir; pontinhos coloridos indicam quais matérias.
  - **Verde:** pode faltar (todas as aulas controladas do dia estão dentro da janela de aproveitamento).
  - **Vermelho:** há aula de matéria **sem saldo** (limite atingido) — faltar reprova.
  - **Cinza, opacidade menor, com listras/número riscado:** feriado/recesso, com o nome.
  - **Magenta:** dia do simulado. Dias depois dele ficam apagados.
  - Fim de semana: apagado.
  - Com uma matéria filtrada, as cores refletem só aquela matéria.
- Ao tocar num dia: painel de **detalhes** (aulas do dia com horário e status de cada uma), **informações** (saldo de cada matéria do dia) e **observações** (ex.: "Eletiva II está sem saldo: qualquer falta reprova"; "Gestão tem 2 aulas neste dia: falte o dia todo ou nenhum").

### Na aba Faltas (reduzido)
Mini calendário do mês só com as cores, sem textos, com link "Abrir calendário ›".

## 7. Notas

### Regras do ICEV
- Três notas de 0 a 10: **P1** (prova, às vezes com quizzes), **P2** (prova e/ou trabalhos e/ou quizzes — varia por professor), **P3** = simulado de 60 questões.
- **Aprovação direta:** P1 + P2 + P3 ≥ 21 (média ≥ 7).
- **REC final:** permitida com média ≥ 4,0. Abaixo disso, reprovado por nota.
- **Aprovação na REC:** (média + REC) ÷ 2 ≥ 6,00 → REC ≥ 12 − média. A REC tem 10 questões; assumimos 1 ponto por questão → questões necessárias = `ceil(12 − média)`.
- **Teto:** nenhuma nota passa de 10.

### Tabela do simulado (acertos → nota)
Usar **exatamente** esta tabela (hard-coded; não usar fórmula, o arredondamento é irregular). De 48 a 60 acertos a nota é 10,00.

```
0 0,00 | 1 0,21 | 2 0,42 | 3 0,62 | 4 0,83 | 5 1,04 | 6 1,25 | 7 1,46 | 8 1,67 | 9 1,87
10 2,08 | 11 2,29 | 12 2,50 | 13 2,71 | 14 2,92 | 15 3,12 | 16 3,33 | 17 3,54 | 18 3,75 | 19 3,96
20 4,17 | 21 4,37 | 22 4,58 | 23 4,79 | 24 5,00 | 25 5,21 | 26 5,42 | 27 5,62 | 28 5,83 | 29 6,04
30 6,25 | 31 6,46 | 32 6,67 | 33 6,87 | 34 7,08 | 35 7,29 | 36 7,50 | 37 7,71 | 38 7,92 | 39 8,12
40 8,33 | 41 8,54 | 42 8,75 | 43 8,96 | 44 9,17 | 45 9,37 | 46 9,58 | 47 9,79 | 48..60 10,00
```

Acertos necessários para uma nota `n` = menor número de acertos cuja nota na tabela é ≥ `n`. A tabela inteira fica disponível na página, com a linha da meta destacada.

### Estado de cada nota (P1, P2)
O aluno marca:
- **Completa:** valor final.
- **Incompleta:** o valor conta como pontos garantidos; o que ainda pode ganhar é `10 − valor` por padrão, ou o que a calculadora disser.
- **Não feita:** vale até 10.

P3 (simulado): feita (com nota) ou não feita.
Padrões ao ler o print: nota preenchida → completa; vazia → não feita.

### O que mostrar por matéria
1. **Resultado atual:** soma dos pontos garantidos (ex.: 7 + — + — = 7).
2. **Pontos restantes:** 21 − atual.
3. **Quanto tirar em cada prova que falta:** divide os pontos restantes **igualmente em pontos** entre as provas/partes que faltam, respeitando o máximo que cada uma ainda pode render (se uma bate no teto, o excedente vai para as outras). Para o simulado, mostra também os acertos.
   - Ex.: P1 10, P2 incompleta com 1 → faltam 10; podem render P2 9 e simulado 10 → 5 em cada → simulado 5,00 = **24 acertos**.
   - Ex.: P1 6,70, P2 e P3 não feitas → 7,15 em cada → **35 acertos** (7,29).
4. **Se não der para passar direto** (máximo possível < 21): caminho da REC — quanto precisa para média ≥ 4 (mesma divisão igual), acertos no simulado, e quantas questões da REC precisaria acertar depois. Se nem a REC for possível: "reprovado por nota".
5. Se todas as notas estiverem completas: situação final (aprovado / REC com X questões necessárias / reprovado).

Selos por matéria: "aprovado", "em andamento", "só com REC", "reprovado".

## 8. Calculadora

- Monta uma nota (P1 ou P2) por partes. Cada parte tem nome, e:
  - **Por pontos:** "vale" (máximo) e "tirei" (opcional). Soma dos máximos = 10.
  - **Por peso:** peso (%) e nota de 0 a 10 (opcional). Soma dos pesos = 100%. Internamente equivale a pontos (parte com peso 30% vale até 3 pontos).
- Partes em branco = ainda não feitas. Resultado: garantido, ainda dá para ganhar, e quanto precisa em cada parte em branco (mesma divisão igual em pontos com teto, convertida para nota 0–10 no modo peso).
- **Ligada a uma matéria e prova:** o resultado vira automaticamente o estado "incompleta" daquela nota (garantido + potencial) na aba Notas.
- Também pode ser usada solta, sem matéria (cálculo livre).
- A tabela do simulado fica ao lado.

## 9. Interface

- **Navegação:** Faltas · Calendário · Notas · Calculadora.
  - Desktop: menu flutuante em vidro no topo.
  - Celular: barra inferior em vidro estilo iOS, com ícone + rótulo.
- **Tema:** claro e escuro, segue o sistema por padrão, com botão ☾/☀ para trocar.
  - Fundo com gradientes/manchas nas cores do ICEV (magenta ≈ `#C8215D`, roxo ≈ `#45226B`, noite ≈ `#1E1230`).
  - Vidro **neutro** (branco translúcido, `backdrop-filter: blur + saturate`), não colorido.
  - Destaques em magenta.
- Cada aba tem sua área de envio de print ("lido do print de DD/MM · enviar novo print").
- Mockups aprovados: `.superpowers/brainstorm/*/content/calendar-v2.html` e `notas-v1.html`.

## 10. Decisões tomadas pelo assistente (para revisão)
- Stack: Vite + TypeScript + Preact, testes com Vitest; Tesseract.js e pdf.js; deploy estático na Vercel (decidido pelo usuário).
- Dados salvos só no aparelho (`localStorage`) com botão para apagar.
- Arredondamento do saldo de aulas para baixo. (Confirmado pelo usuário: **acima** de 25% reprova; exatamente 25% passa.)
- Todas as matérias seguem a mesma regra de notas (P1 + P2 + P3 ≥ 21, REC).
- Calendário: dia verde só se **todas** as aulas controladas do dia são liberadas; vermelho se houver matéria sem saldo; senão branco.
- Divisão igual também dentro de uma nota composta.
- **Data do print:** cada print guarda a data em que foi tirado (padrão: dia do envio, editável). Há um campo opcional "faltas que ainda não apareceram no portal" por matéria, somado às faltas do print. Aulas entre a data do print e hoje são consideradas presença, com aviso "confira se o portal já lançou todas as faltas".
- **Dias de aula extra:** além de "dias sem aula", o aluno (ou o PDF do calendário) pode marcar dias com aula extra/reposição, dizendo qual dia da semana aquele dia segue. O algoritmo usa a lista de dias resultante.
- **Média e REC sem arredondamento:** média = soma ÷ 3 com precisão total; questões da REC = `ceil(12 − média)`; comparações conservadoras (nunca arredondar a favor do aluno).
- Sem a logo do ICEV; rodapé "ferramenta não oficial".

## 11. Pendências
- PDF do calendário acadêmico do ICEV (formato e se traz a data do simulado).
- Confirmar feriados estaduais/municipais do Piauí/Teresina.

## 12. Deixado para o construtor
- Pré-processamento das imagens para o OCR (escala, binarização, recorte por colunas) e heurísticas de parsing de cada print.
- Algoritmo de busca aproximada de nomes.
- Estrutura de componentes, ícones, animações e detalhes de acessibilidade.
