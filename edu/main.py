from flask import Flask, jsonify, request, render_template, url_for,stream_with_context, Response
from flask_cors import CORS
import openai
from openai import OpenAI
import os
import json

app = Flask(__name__)
CORS(app)
openai.api_key = os.getenv("OPENAI_API_KEY")  # Api key
# Define initial states


initial_conversation = [{
    "role": "system",
    "content": ("You are a helpful assistant for answering rail-related questions. You should provide specific explanations and extend the related knowledge to the user. However, you also need to keep the response concise.")
}]

initial_hint_list = [{
    "role": "system",
    "content": "You are a helpful assistant. Provide hints to the user based on the current question and their choice. It needs to be brief and concise."
}]

initial_explain_list = [{
    "role": "system",
    "content": "You are a helpful assistant, skilled in explaining rail-related concepts. "
                "Your responses should be clear and educational but need to be brief and concise."
                
}]

# Global variables to maintain state
message = []
conversation = []
hint_list = []
explain_list = []

# Function to reset history
def resetHistory():
    global message, conversation, hint_list, explain_list
    conversation = initial_conversation[:]
    hint_list = initial_hint_list[:]
    explain_list = initial_explain_list[:]

client = OpenAI()

def gpt4_dialogue(conversation):  # fetch question through openAi Api
    try:
        response = client.chat.completions.create(
            model="gpt-4-1106-preview",
            messages=conversation,
        )
        response_content = response.choices[0].message.content
        print(response_content)
        return response_content
    except Exception as e:
        print(e)
        return {"error": "There was an error processing the request."}


    

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/favicon.ico')
def favicon():
    return url_for('static', filename='favicon.ico')


@app.route('/ask', methods=['POST'])
def get_gpt3_question():
    resetHistory()
    data = request.get_json()
    topic = data.get('topic', '')  # Provide a default empty string if no topic is found
    message = [{
    "role": "system",
    "content": f"You are a helpful assistant. Please provide 5 questions related to the topic: {topic} in JSON "
                "format. You need to be creative in creating those questions to avoid repetition. "
                "Each question should include a question field and an answers field which is an array of answer choices. "
                "Each answer choice should have a text field and a correct field indicating if it's the right answer. "
                "Your response should only contain data that's good to parse in JSON (start with [ and end with ]). "
                "The format should look like this example: "
                '[{"question": "What is the fastest train in the world?", "answers": [{"text": "Shinkansen", "correct": false}, {"text": "TGV", "correct": false}, {"text": "Maglev", "correct": true}, {"text": "Eurostar", "correct": false}]},'
                '{"question": "Which city has the oldest metro system?", "answers": [{"text": "New York", "correct": false}, {"text": "Paris", "correct": false}, {"text": "London", "correct": true}, {"text": "Tokyo", "correct": false}]}]'
}]
    response_data = gpt4_dialogue(message)  # Call GPT-4 with the full message
    return jsonify(response_data.strip('```json'))

@app.route('/stream', methods=['POST'])
def stream():
    user_input = request.json['message']
    print(user_input)
    conversation.append({"role": "user", "content": user_input})
    def generate():
        # Stream Prompt
        stream = client.chat.completions.create(
            model="gpt-4-1106-preview",
            messages=conversation,
            stream=True,
        )
        full_response = ""
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                data = chunk.choices[0].delta.content
                full_response += data
                yield data
        conversation.append({"role": "assistant", "content": full_response})
    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/hint', methods=['POST'])
def hint():
    user_input = request.json['message']  # 用户在类型容器中输入的文本
    current_question = request.json['currentQuestion']  # 当前问题文本
    options = request.json['options']  # 当前问题的选项列表

    # 构建对话历史，包括当前问题、选项和用户输入
    hint_list.append({"role": "system", "content": f"Current question: {current_question}"})
    options_content = ", ".join([f"{opt['text']}" for opt in options])
    hint_list.append({"role": "system", "content": f"Options: {options_content}"})
    hint_list.append({"role": "user", "content": user_input})

    def generate():
        # 请求 GPT-4 获取提示
        try:
            stream = client.chat.completions.create(
                model="gpt-4-1106-preview",
                messages=hint_list,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    data = chunk.choices[0].delta.content
                    yield data
                    hint_list.append({"role": "assistant", "content": data})
        except Exception as e:
            print(e)
            yield "Error generating hint."

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/explain', methods=['POST'])
def explain():
    current_question = request.json['currentQuestion']
    selected_option = request.json['selectedOption']
    is_correct = request.json['isCorrect']
    options = request.json['options']

    # 构建对话历史，包括问题、选项和用户选择
    options_content = ", ".join([f"{opt['text']}" for opt in options])
    explain_list.append({"role": "system", "content": f"Question: {current_question}, Options: {options_content}, Selected: {selected_option}"})

    # 根据用户选择的正确性更新系统提示
    if is_correct:
        system_prompt = "The user has selected the correct answer. Provide encouragement and extend the topic with additional related information."
    else:
        system_prompt = "The user has selected the wrong answer. Provide a clear explanation for the correct answer and extend the topic with additional related information."

    # 添加系统提示到对话历史
    explain_list.append({"role": "system", "content": system_prompt})
   
    def generate():
        # Stream Prompt
        try:
            stream = client.chat.completions.create(
                model="gpt-4-1106-preview",
                messages=explain_list,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    data = chunk.choices[0].delta.content
                    yield data
                    explain_list.append({"role": "assistant", "content": data})
        except Exception as e:
            print(e)
            yield "Error generating explanation."

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=5000, debug=True)
    app.run(host='0.0.0.0', port=4000)
