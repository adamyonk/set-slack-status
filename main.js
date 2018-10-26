import fetch from "node-fetch";
import { filter } from "fuzzy";
import inquirer from "inquirer";
import autocomplete from "inquirer-autocomplete-prompt";
inquirer.registerPrompt("autocomplete", autocomplete);

const TOKEN = process.env.SLACK_TOKEN;
if (!TOKEN) {
  console.error("Please supply a SLACK_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`
};

const checkResponse = async response => {
  const body = await response.json();
  if (response.ok === false || body.ok === false) {
    console.error(response.status, response.statusText);
    process.exit(1);
  }
  return body;
};

(async function() {
  let defaultEmoji = await checkResponse(
    await fetch(
      "https://raw.githubusercontent.com/iamcal/emoji-data/master/emoji.json"
    )
  );
  defaultEmoji = defaultEmoji.reduce((a, v) => a.concat(v.short_names), []);

  let { emoji } = await checkResponse(
    await fetch("https://slack.com/api/emoji.list", {
      headers
    })
  );
  emoji = Object.keys(emoji)
    .concat(defaultEmoji)
    .sort();
  emoji.unshift("");

  const profile = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "status_emoji",
      message: "Set an emoji?",
      pageSize: 10,
      source: async (answersSoFar, input = "") =>
        filter(input, emoji).map(e => e.original)
      // emoji.filter(e => e.toLowerCase().match(input.toLowerCase()))
    },
    {
      default: "",
      message: "What's your status?",
      name: "status_text",
      type: "input"
    },
    // {
    //   default: "",
    //   message: "Set an emoji?",
    //   name: "status_emoji",
    //   type: "input"
    // },
    {
      default: "0",
      message: "When should it expire?",
      name: "status_expiration",
      type: "input"
    }
  ]);
  profile.status_expiration = parseFloat(profile.status_expiration);

  if (profile.status_emoji != "") {
    profile.status_emoji = `:${profile.status_emoji}:`;
  }

  if (profile.status_expiration != 0) {
    const now = Math.round(Date.now() / 1000);
    profile.status_expiration = profile.status_expiration * 60 + now;
  }

  await checkResponse(
    await fetch("https://slack.com/api/users.profile.set", {
      method: "POST",
      body: JSON.stringify({ profile }),
      headers: {
        ...headers,
        "Content-type": "application/json; charset=utf-8"
      }
    })
  );

  console.log("💬");
})();

// POST /api/users.profile.set
// Host: slack.com
// Content-type: application/json; charset=utf-8
// Authorization: Bearer xoxp_secret_token
// {
//     "profile": {
//         "status_text": "riding a train",
//         "status_emoji": ":mountain_railway:",
//         "status_expiration": 0
//     }
// }
