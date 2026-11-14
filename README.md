# icevbooster

Ferramenta **não oficial** para estudantes do ICEV: calcula quantas faltas você ainda pode ter e quanto precisa tirar nas provas. Confira sempre os números no portal do ICEV.

## Privacidade

Tudo fica no seu navegador (localStorage). O OCR roda localmente. No primeiro uso do OCR, o navegador baixa o worker do Tesseract, o núcleo WASM e os dados de idioma em português da CDN jsDelivr (arquivos estáticos). Suas imagens e seus dados nunca são enviados a lugar nenhum. O botão "Apagar meus dados" no rodapé limpa tudo.

## Como rodar

```
npm install
npm run dev
```

## Testes

```
npm test
```

## Build

```
npm run build
```

## Regenerar fixtures de OCR

Precisa dos prints em `examples/` (não versionados):

```
npx tsx scripts/ocr-fixtures.ts
```

## Deploy (Vercel)

```
npx vercel login
npx vercel --prod
```
