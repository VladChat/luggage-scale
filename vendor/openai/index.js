class OpenAIClient {
  constructor(options = {}) {
    const {
      apiKey,
      baseURL = "https://api.openai.com/v1",
      organization,
      project,
      defaultHeaders = {},
    } = options;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to initialize the client");
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
    this.defaultHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...defaultHeaders,
    };

    if (organization) {
      this.defaultHeaders["OpenAI-Organization"] = organization;
    }

    if (project) {
      this.defaultHeaders["OpenAI-Project"] = project;
    }

    this.chat = {
      completions: {
        create: payload => this.#post("/chat/completions", payload),
      },
    };
  }

  async #post(path, payload = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload must be an object when calling the OpenAI API");
    }

    const url = `${this.baseURL}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      const parseError = new Error(
        `Failed to parse OpenAI response as JSON: ${error.message}`
      );
      parseError.cause = error;
      parseError.rawBody = text;
      throw parseError;
    }

    if (!response.ok) {
      const error = new Error(
        `OpenAI API request failed with status ${response.status}`
      );
      error.status = response.status;
      error.body = data;
      throw error;
    }

    return data;
  }
}

module.exports = OpenAIClient;
module.exports.OpenAI = OpenAIClient;
module.exports.default = OpenAIClient;
