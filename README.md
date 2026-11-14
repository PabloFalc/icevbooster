# icevbooster

Ferramenta **não oficial** para estudantes do ICEV: calcula quantas faltas você ainda pode ter e quanto precisa tirar nas provas. Confira sempre os números no portal do ICEV.

## Privacidade

Tudo fica no seu navegador (localStorage); nenhum dado seu é enviado a servidor. O OCR dos prints roda localmente. Só os dados de idioma do Tesseract são baixados de uma CDN na primeira vez que o OCR é usado. O botão "Apagar meus dados" no rodapé limpa tudo.

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
