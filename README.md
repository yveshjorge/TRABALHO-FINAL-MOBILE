# TRABALHO-FINAL-MOBILE — Léxica Mobile

Aplicativo React Native para profissionais de tradução. O projeto reaproveita o domínio de glossários, termos, idiomas e memórias OPUS do trabalho de Métodos Ágeis e acrescenta os requisitos mobile do Projeto N2.

## Executar

Requisitos: Node.js 24+, npm e Expo Go no Android/iOS.

    npm ci
    npm start

Leia o QR code com o Expo Go. Na primeira entrada em um aparelho sem dados de demonstração, use **Abrir demonstração com exemplos** para conferir os CRUDs e o SQLite sem configuração de nuvem. Esse modo carrega um projeto, um glossário e três termos jurídicos ilustrativos; não cria conta nem envia os exemplos ao Firestore. Para demonstrar autenticação e Firestore, configure o Firebase abaixo e crie seus registros na sua conta.

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
| React Native | Expo + React Native, sem interface web adaptada |
| Três CRUDs completos | Projetos, Glossários e Termos: criar, listar, editar e excluir |
| Firebase Authentication | Cadastro e acesso por e-mail/senha; sessão persistida no aparelho |
| Firestore | Dados da conta em subcoleções isoladas por UID |
| SQLite local | Tabelas de registros, fila de sincronização e pares TMX |
| Offline e sincronização | CRUD local imediato; fila idempotente enviada quando a conexão volta |
| API externa pertinente | Catálogo OPUS, amostra TMX local e busca de correspondências MyMemory |

## Guia para apresentar e defender o projeto

Consulte [docs/GUIA-DE-APRESENTACAO.md](docs/GUIA-DE-APRESENTACAO.md) para ver a arquitetura, a integração com Authentication e Firestore, o funcionamento do SQLite e da sincronização, o fluxo OPUS/TMX/MyMemory, o roteiro de demonstração e respostas para perguntas prováveis do professor.

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
- src/opus.ts e src/tmx-parser.ts: catálogo OPUS, download limitado, parser de amostra TMX/GZIP/ZIP e consulta MyMemory.
- firestore.rules: isolamento dos documentos por UID.
- DESIGN.md e UX-CONTRACT.md: identidade visual e comportamento offline dos fluxos.

O OPUS e o MyMemory precisam de internet. A consulta MyMemory tem limite de 500 bytes e só acontece após uma ação explícita. A importação OPUS para após encontrar até 1.000 pares no início do arquivo e limita o fluxo para evitar baixar corpora completos no celular; essa amostra não representa o corpus inteiro. Licenças e atribuição variam por coleção; confirme as condições da base antes de usar seu conteúdo.

## Verificar

    npm run check
    npm test
    npm run export:android

