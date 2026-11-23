# TRABALHO-FINAL-MOBILE — Léxica Mobile

Aplicativo React Native para profissionais de tradução. O projeto reaproveita o domínio de glossários, termos, idiomas e memórias OPUS do trabalho de Métodos Ágeis e acrescenta os requisitos mobile do Projeto N2.

## Executar no celular

Requisitos: Node.js 24+, npm e Expo Go no Android/iOS.

```powershell
npm ci
npm start
```

Leia o QR code com o Expo Go. Na primeira entrada em um aparelho sem dados de demonstração, use **Abrir demonstração com exemplos** para conferir os CRUDs e o SQLite sem configuração de nuvem. Esse modo carrega um projeto, um glossário e três termos jurídicos ilustrativos; não cria conta nem envia os exemplos ao Firestore. Para demonstrar autenticação e Firestore, configure o Firebase abaixo e crie seus registros na sua conta.

## Apresentar no navegador com formato mobile

O app também pode ser apresentado pelo navegador com a interface em formato de celular.

### Iniciar a versão Web no Windows

1. Instale Node.js 24 ou superior. Abra o PowerShell na pasta do projeto.
2. Instale as dependências (na primeira execução ou depois de atualizar o projeto):

   ```powershell
   npm ci
   ```

3. Para usar login e Firestore, copie `.env.example` para `.env` e preencha os cinco valores `EXPO_PUBLIC_FIREBASE_*` indicados na seção Firebase. Para abrir a demonstração local, esse arquivo é opcional.
4. Gere o build Web e inicie o servidor local:

   ```powershell
   npm run web
   ```

5. Enquanto o terminal continuar aberto, acesse **http://localhost:4178** no navegador. Em uma janela larga, o app aparece centralizado numa moldura de celular; em janela estreita, ocupa a tela. O botão **Abrir demonstração com exemplos** permite experimentar sem uma conta Firebase.

O comando `npm run web` exporta o app para a pasta `dist` e serve esse build localmente. Aguarde a mensagem de que o Lexica Mobile Web está disponível antes de abrir o endereço. Para parar o servidor, volte ao terminal e pressione **Ctrl+C**. Se mudar `.env`, pare o processo e rode `npm run web` novamente para gerar um build com a configuração atualizada.

Se a porta 4178 já estiver em uso, escolha outra no PowerShell e abra o endereço correspondente:

```powershell
$env:PORT = 4179
npm run web
```

Depois acesse **http://localhost:4179**. Para o login Firebase em um domínio diferente, autorize o domínio em **Authentication → Settings → Authorized domains**.

Na versão Web, SQLite usa WebAssembly e guarda os dados no perfil do navegador. Esse armazenamento é independente do SQLite do celular. Para levar os registros da conta entre aparelhos, entre na mesma conta Firebase e sincronize com o Firestore. O servidor local já inclui os cabeçalhos exigidos pelo SQLite Web. Para hospedar a pasta `dist` em outro serviço, configure **Cross-Origin-Embedder-Policy: credentialless** e **Cross-Origin-Opener-Policy: same-origin**.

## Configurar Firebase

1. Crie um projeto no Firebase Console e registre um aplicativo Web para obter o objeto de configuração.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Crie o banco em **Firestore Database**.
4. Copie .env.example para .env e preencha os cinco valores EXPO_PUBLIC_FIREBASE_* do objeto de configuração.
5. Instale o Firebase CLI, entre na sua conta e associe o projeto:

    firebase login
    firebase use --add

6. Publique as regras deste projeto:

    firebase deploy --only firestore:rules

7. Reinicie o Expo (Ctrl+C, depois npm start). Crie uma conta na tela do aplicativo.

Os valores de configuração do cliente Firebase identificam o projeto, mas não substituem as regras do Firestore. Não coloque chaves privadas de contas de serviço no aplicativo. Cada documento é salvo sob users/{uid}/projects, users/{uid}/glossaries ou users/{uid}/terms; as regras limitam acesso ao usuário autenticado.

## O que atende ao enunciado

| Requisito | Implementação |
| --- | --- |
| Interface | Expo + React Native, executável no celular e no navegador com apresentação mobile |
| Três CRUDs completos | Projetos, Glossários e Termos: criar, listar, editar e excluir |
| Firebase Authentication | Cadastro e acesso por e-mail/senha; sessão persistida no aparelho |
| Firestore | Dados da conta em subcoleções isoladas por UID |
| SQLite local | Tabelas de registros, fila de sincronização e pares TMX |
| Offline e sincronização | CRUD local imediato; fila idempotente enviada quando a conexão volta |
| API externa pertinente | Catálogo OPUS, amostra TMX local e busca de correspondências MyMemory |

## Guia para apresentar e defender o projeto

Consulte [docs/GUIA-DE-APRESENTACAO.md](docs/GUIA-DE-APRESENTACAO.md) para ver a arquitetura, a integração com Authentication e Firestore, o funcionamento do SQLite e da sincronização, o fluxo OPUS/TMX/MyMemory, o roteiro de demonstração e respostas para perguntas prováveis do professor.

Para estudar a implementação em profundidade, consulte também [docs/GUIA-LEITURA-DO-CODIGO.md](docs/GUIA-LEITURA-DO-CODIGO.md). Ele percorre os arquivos-fonte e explica passo a passo como SQLite, outbox, Firebase Authentication e Firestore trabalham juntos.

## Demonstração para a apresentação

1. Crie conta e cadastre um projeto, um glossário e um termo.
2. Mostre no Firebase Console os documentos sob o UID da conta.
3. Desligue a internet e crie ou edite um termo. O item deve aparecer como pendente e continuar disponível no aplicativo.
4. Restaure a conexão ou toque em **Sincronizar**. Confirme a mudança no Firestore e o estado “Na nuvem”.
5. Em **OPUS**, consulte o catálogo, importe uma amostra de até 1.000 pares e pesquise nela com o aparelho offline.
6. Consulte uma frase no MyMemory quando estiver online. A tela avisa que somente a frase enviada é transmitida ao serviço.

## Estrutura

- App.tsx: autenticação, abas, estado da conexão e sincronização.
- src/screens/CrudScreen.tsx: formulário e ciclo completo de CRUD reutilizados pelas três entidades.
- src/database.ts: SQLite do aparelho, fila outbox, tombstones e memórias TMX.
- src/sync.ts: leitura e envio das subcoleções Firestore do usuário.
- src/firebase.ts: Firebase Authentication persistente e Firestore.
- src/components/AppViewport.tsx: mantém a área do app em formato de celular no navegador.
- metro.config.cjs e scripts/serve-web.mjs: habilitam SQLite Web e servem a prévia local com os cabeçalhos necessários.
- src/opus.ts e src/tmx-parser.ts: catálogo OPUS, download limitado, parser de amostra TMX/GZIP/ZIP e consulta MyMemory.
- firestore.rules: isolamento dos documentos por UID.
- DESIGN.md e UX-CONTRACT.md: identidade visual e comportamento offline dos fluxos.

O OPUS e o MyMemory precisam de internet. A consulta MyMemory tem limite de 500 bytes e só acontece após uma ação explícita. A importação OPUS para após encontrar até 1.000 pares no início do arquivo e limita o fluxo para evitar baixar corpora completos no celular; essa amostra não representa o corpus inteiro. Licenças e atribuição variam por coleção; confirme as condições da base antes de usar seu conteúdo.

## Verificar

    npm run check
    npm test
    npm run export:android
    npm run export:web

