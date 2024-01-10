from flask import Flask, jsonify, request, render_template, url_for,stream_with_context, Response, send_file, after_this_request
from flask_cors import CORS
import openai
from openai import OpenAI
import os
import random
app = Flask(__name__)
CORS(app)
openai.api_key = os.getenv("OPENAI_API_KEY")  # Api key
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
initial_determine_list = [{
    "role": "system",
    "content": ("You are a highly intelligent assistant capable of understanding complex requests related to image generation. "
                "When you receive a user message, your task is to analyze it and determine the nature of the request. "
                "If the user's message implies a request for an image, respond with 'type: image' followed by a precise and relevant keyword or phrase that can be used to generate an image with a model like DALL-E. "
                "For example, if the user asks for a picture of a 'sunset over mountains', you should respond with 'type: image' and 'keyword: sunset over mountains'. "
                "If the user's message does not imply a request for an image, respond with 'type: text'.Your respond should not contain other text since the app is going to use different function by matching depends on your respond")
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
    response_data = gpt4_dialogue(message)  
    return jsonify(response_data.strip('```json'))

#Default endpoint
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

#hint endpoint(before answer question)
@app.route('/hint', methods=['POST'])
def hint():
    user_input = request.json['message']  
    current_question = request.json['currentQuestion']  
    options = request.json['options'] 
    hint_list.append({"role": "system", "content": f"Current question: {current_question}"})
    options_content = ", ".join([f"{opt['text']}" for opt in options])
    hint_list.append({"role": "system", "content": f"Options: {options_content}"})
    hint_list.append({"role": "user", "content": user_input})

    def generate():
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

#explain endpoint(after answer question)
@app.route('/explain', methods=['POST'])
def explain():
    current_question = request.json['currentQuestion']
    selected_option = request.json['selectedOption']
    is_correct = request.json['isCorrect']
    options = request.json['options']
    options_content = ", ".join([f"{opt['text']}" for opt in options])
    explain_list.append({"role": "system", "content": f"Question: {current_question}, Options: {options_content}, Selected: {selected_option}"})
    if is_correct:
        system_prompt = "The user has selected the correct answer. Provide encouragement and extend the topic with additional related information."
    else:
        system_prompt = "The user has selected the wrong answer. Provide a clear explanation for the correct answer and extend the topic with additional related information."
    explain_list.append({"role": "system", "content": system_prompt})
   
    def generate():
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


voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]#supported type of voice
@app.route('/tts', methods=['POST'])
def text_to_speech():
    data = request.get_json()
    text = data['text']
    voice = random.choice(voices)
    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
            speed=1.2
        )

        audio_file_path = os.path.join(app.root_path, 'speech.mp3')
        response.stream_to_file(audio_file_path)

        return send_file(audio_file_path, mimetype='audio/mpeg')
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "TTS generation failed"}), 500

#image-generation endpoint
@app.route('/generate-image', methods=['POST'])
def generate_image():
    data = request.get_json()
    prompt = data['prompt']
    image_url = create_image(prompt)
    return jsonify({'imageUrl': image_url})

def create_image(prompt):
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=f"A photograph of {prompt}",
            size="1792x1024",
            quality="standard",
            n=1,
)
        url = response.data[0].url
        print(url)
        return url
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "Image generation failed"}), 500
    
import googleapiclient.discovery

api_key = os.getenv("YOUTUBE_API_KEY")
#google api client youtube endpoint
def search_youtube_videos(api_key, search_query):
    youtube = googleapiclient.discovery.build('youtube', 'v3', developerKey=api_key)

    search_response = youtube.search().list(
        q=search_query,
        part='snippet',
        maxResults=1
    ).execute()

    videos = []
    for video in search_response.get('items', []):
        if video['id']['kind'] == 'youtube#video':
            video_title = video['snippet']['title']
            video_id = video['id']['videoId']
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            videos.append((video_title, video_url))

    return videos
#youtube video search endpoint
@app.route('/search-video', methods=['POST'])
def search_video():
    data = request.get_json()
    search_query = data.get('query', '')
    video_results = search_youtube_videos(api_key, search_query)
    for video_title, video_url in video_results:
        print(f'Title: {video_title}')
        print(f'URL: {video_url}')
    if video_results:
        video_title, video_url = video_results[0]
    else:
        video_title, video_url = ("No video found", "")
    return jsonify({'videoTitle': video_title, 'videoUrl': video_url})


@app.route('/gpt-determine-action', methods=['POST'])
def gpt_determine_action():
    data = request.get_json()
    message = data['message']
    initial_determine_list = [{
    "role": "system",
    "content": ("You are a highly intelligent assistant capable of understanding complex requests related to image generation. "
                "When you receive a user message, your task is to analyze it and determine the nature of the request. "
                "If the user's message implies a request for an image, respond with 'type: image' followed by a precise and relevant keyword or phrase that can be used to generate an image with a model like DALL-E. "
                "For example, if the user asks for a picture of a 'sunset over mountains', you should respond with 'type: image' and 'keyword: sunset over mountains'. "
                "If the user's message does not imply a request for an image, respond with 'type: text'.Your respond should not contain other text since the app is going to use different function by matching depends on your respond")
}]
    initial_determine_list.append({"role": "user", "content": message})
    try:
        response = client.chat.completions.create(
            model="gpt-4-1106-preview",
            messages=initial_determine_list,
        )
        response_content = response.choices[0].message.content
        if response_content.startswith('type: image'):
            keyword = response_content.split('keyword: ')[1] if 'keyword: ' in response_content else ""
            return jsonify({'type': 'image', 'keyword': keyword})
        else:
            return jsonify({'type': 'text'})
    except Exception as e:
        print(e)
        return jsonify({"error": "Error processing the GPT-4 request."}), 500




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000)
    
