from flask import Flask, jsonify, request, render_template, url_for
from flask_cors import CORS
import openai
import os
import json

app = Flask(__name__)
CORS(app)
openai.api_key = os.getenv("OPENAI_API_KEY")  # Api key
message = [{
    "role": "system",
    "content": "You are a helpful assistant. Please provide 5 questions related to rail transportation in JSON "
               "format. You need to creative in creating those question to avoid repetition"
               "Each question should include a question field and an answers field which is an array of answer choices."
               "Each answer choice should have a text field and a correct field indicating if it's the right answer."
               "Your respond should only contain data that's good to parse in json (start with [ and end with ]"
               "The format should look like this example: "
               '[{"question": "What is the fastest train in the world?", "answers": [{"text": "Shinkansen", '
               '"correct": false}, '
               '{"text": "TGV", "correct": false}, {"text": "Maglev", "correct": true}, {"text": "Eurostar", '
               '"correct": false}]},'
               '{"question": "Which city has the oldest metro system?", "answers": [{"text": "New York", "correct": '
               'false}, '
               '{"text": "Paris", "correct": false}, {"text": "London", "correct": true}, {"text": "Tokyo", '
               '"correct": false}]}]'
}]


def gpt4_dialogue(messages):  # fetch question through openAi Api
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-1106-preview",
            temperature=0.7,
            messages=messages
        )
        response_content = response['choices'][0]['message']['content']
        return json.loads(response_content)
    except Exception as e:
        print(e)
        return {"error": "There was an error processing the request."}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/favicon.ico')
def favicon():
    return url_for('static', filename='favicon.ico')


@app.route('/ask', methods=['GET'])
def get_gpt3_question():
    response_data = gpt4_dialogue(message)
    return jsonify(response_data)


if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=5000, debug=True)
    app.run(host='0.0.0.0', port=5000)
