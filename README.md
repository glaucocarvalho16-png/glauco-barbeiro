# Glauco Barbeiro — V16.1

Sistema simples de agendamento com:

- Página pública de agendamento
- Painel administrativo
- Regras de disponibilidade por dia/horário
- Duração por serviço
- Bloqueio automático de conflito de horários
- `GET /webhook` para verificação da Meta
- `POST /webhook` para receber mensagens do WhatsApp
- Fluxo automático de escolha de serviço, data e horário

## Rodar localmente

1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env`.
4. Defina uma senha segura para `ADMIN_PASSWORD`.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

## Variáveis para WhatsApp Cloud API

- `WHATSAPP_VERIFY_TOKEN`: token criado por você para validar o webhook.
- `WHATSAPP_ACCESS_TOKEN`: token da Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número do WhatsApp Business na Meta.
- `WHATSAPP_API_VERSION`: versão da Graph API.

O endpoint público que deve ser configurado na Meta será:

`https://SEU-DOMINIO/webhook`

## Importante

O arquivo `.env` contém segredos e **não deve ser enviado ao GitHub**.
Use `.env.example` apenas como modelo.
