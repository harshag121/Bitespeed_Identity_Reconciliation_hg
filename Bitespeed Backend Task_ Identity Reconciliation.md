# Bitespeed Backend Task: Identity Reconciliation

Meet the brilliant yet eccentric Dr. Emmett Brown, better known as Doc.
Hopelessly stuck in 2023, he is fixing his time machine to go back to the future and save his friend.
His favourite online store `FluxKart.com` sells all the parts required to build this contraption.
To avoid drawing attention to his grandiose project, Doc is using different email addresses and phone numbers for each purchase.

`FluxKart.com` is serious about customer experience and rewards loyal customers with personalised experiences.
To do this, FluxKart integrates Bitespeed, which collects contact details from shoppers.

Given Doc's behaviour, Bitespeed faces a challenge:
linking different orders made with different contact information to the same person.

## Bitespeed Needs Your Help!

Bitespeed needs a way to identify and keep track of a customer's identity across multiple purchases.

Orders on `FluxKart.com` will always have either an email or `phoneNumber` in the checkout event.

Bitespeed keeps track of collected contact information in a relational database table named `Contact`.

```ts
{
  id             Int
  phoneNumber    String?
  email          String?
  linkedId       Int? // the ID of another Contact linked to this one
  linkPrecedence "secondary" | "primary" // "primary" if it's the first Contact in the link
  createdAt      DateTime
  updatedAt      DateTime
  deletedAt      DateTime?
}
```

One customer can have multiple `Contact` rows in the database.
All rows are linked together, with the oldest treated as `primary` and the rest as `secondary`.

`Contact` rows are linked if they have either email or phone in common.

For example:

If a customer placed an order with:
- `email=lorraine@hillvalley.edu`
- `phoneNumber=123456`

and later placed another order with:
- `email=mcfly@hillvalley.edu`
- `phoneNumber=123456`

database will have:

```json
{
  "id": 1,
  "phoneNumber": "123456",
  "email": "lorraine@hillvalley.edu",
  "linkedId": null,
  "linkPrecedence": "primary",
  "createdAt": "2023-04-01 00:00:00.374+00",
  "updatedAt": "2023-04-01 00:00:00.374+00",
  "deletedAt": null
}

{
  "id": 23,
  "phoneNumber": "123456",
  "email": "mcfly@hillvalley.edu",
  "linkedId": 1,
  "linkPrecedence": "secondary",
  "createdAt": "2023-04-20 05:30:00.11+00",
  "updatedAt": "2023-04-20 05:30:00.11+00",
  "deletedAt": null
}
```

## Requirements

Design a web service with endpoint `/identify` that receives HTTP `POST` requests with JSON body:

```json
{
  "email"?: "string",
  "phoneNumber"?: "number"
}
```

The web service should return HTTP `200` with a JSON payload containing the consolidated contact.

Response format:

```json
{
  "contact": {
    "primaryContatctId": "number",
    "emails": ["string"],
    "phoneNumbers": ["string"],
    "secondaryContactIds": ["number"]
  }
}
```

Notes:
- First element in `emails` should be the email of the primary contact.
- First element in `phoneNumbers` should be the phone number of the primary contact.
- `secondaryContactIds` is the array of all `Contact` IDs that are secondary to the primary contact.

Extending the previous example:

Request:

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Response:

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

All of the following requests should also return the above response:

```json
{
  "email": null,
  "phoneNumber": "123456"
}
```

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": null
}
```

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": null
}
```

## What happens if no existing contacts match?

Create a new `Contact` row with `linkPrecedence="primary"`, treat it as a new customer, and return empty `secondaryContactIds`.

## When is a secondary contact created?

If an incoming request has either `phoneNumber` or `email` in common with an existing contact but also contains new information, create a `secondary` contact row.

Example:

Existing database state:

```json
{
  "id": 1,
  "phoneNumber": "123456",
  "email": "lorraine@hillvalley.edu",
  "linkedId": null,
  "linkPrecedence": "primary",
  "createdAt": "2023-04-01 00:00:00.374+00",
  "updatedAt": "2023-04-01 00:00:00.374+00",
  "deletedAt": null
}
```

Identify request:

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

New database state:

```json
{
  "id": 1,
  "phoneNumber": "123456",
  "email": "lorraine@hillvalley.edu",
  "linkedId": null,
  "linkPrecedence": "primary",
  "createdAt": "2023-04-01 00:00:00.374+00",
  "updatedAt": "2023-04-01 00:00:00.374+00",
  "deletedAt": null
}

{
  "id": 23,
  "phoneNumber": "123456",
  "email": "mcfly@hillvalley.edu",
  "linkedId": 1,
  "linkPrecedence": "secondary",
  "createdAt": "2023-04-20 05:30:00.11+00",
  "updatedAt": "2023-04-20 05:30:00.11+00",
  "deletedAt": null
}
```

## Can primary contacts turn into secondary?

Yes.

Existing database state:

```json
{
  "id": 11,
  "phoneNumber": "919191",
  "email": "george@hillvalley.edu",
  "linkedId": null,
  "linkPrecedence": "primary",
  "createdAt": "2023-04-11 00:00:00.374+00",
  "updatedAt": "2023-04-11 00:00:00.374+00",
  "deletedAt": null
}

{
  "id": 27,
  "phoneNumber": "717171",
  "email": "biffsucks@hillvalley.edu",
  "linkedId": null,
  "linkPrecedence": "primary",
  "createdAt": "2023-04-21 05:30:00.11+00",
  "updatedAt": "2023-04-21 05:30:00.11+00",
  "deletedAt": null
}
```

Request:

```json
{
  "email": "george@hillvalley.edu",
  "phoneNumber": "717171"
}
```

New database state:

```json
{
  "id": 11,
  "phoneNumber": "919191",
  "email": "george@hillvalley.edu",
  "linkedId": null,
  "linkPrecedence": "primary",
  "createdAt": "2023-04-11 00:00:00.374+00",
  "updatedAt": "2023-04-11 00:00:00.374+00",
  "deletedAt": null
}

{
  "id": 27,
  "phoneNumber": "717171",
  "email": "biffsucks@hillvalley.edu",
  "linkedId": 11,
  "linkPrecedence": "secondary",
  "createdAt": "2023-04-21 05:30:00.11+00",
  "updatedAt": "2023-04-28 06:40:00.23+00",
  "deletedAt": null
}
```

Response:

```json
{
  "contact": {
    "primaryContatctId": 11,
    "emails": ["george@hillvalley.edu", "biffsucks@hillvalley.edu"],
    "phoneNumbers": ["919191", "717171"],
    "secondaryContactIds": [27]
  }
}
```

## What stack to use?

- Database: Any SQL database can be used.
- Backend framework: Node.js with TypeScript is preferred, but any other framework can also be used.

## How to submit this task?

1. Publish the code repository to GitHub.
2. Keep making small commits with insightful messages.
3. Expose the `/identify` endpoint.
4. Host your app online and share the endpoint in the README file (you can use free hosting services like `render.com`).
5. Use JSON body, not form-data, for request payloads.
6. Submit the task here: `https://forms.gle/hsQBJQ8tzbsp53D77`

More about Bitespeed:
- Way of Life at BiteSpeed - Our Values & Purpose
