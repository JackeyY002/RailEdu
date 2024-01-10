let questions = [];

// When the page loads, set up event listeners and start the quiz.
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const quizApp = document.getElementById('quiz-app');

    // Event handler for clicking the start button
    startButton.addEventListener('click', () => {
        const topic = document.querySelector('input.topic-input').value.trim() || 'rail and transportation';
        startScreen.style.display = 'none'; 
        quizApp.style.display = 'flex'; 
        fetchQuizQuestions(topic); 
    });

    // Add event listener for confirm button
    let confirmButton = document.getElementById('confirm-btn');
    if (confirmButton) {
        confirmButton.addEventListener('click', confirmAnswer);
    }

    // Add event listener for Enter key in textarea
    const textarea = document.querySelector('.typing-textarea textarea');
    textarea.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
});


// Function to fetch quiz questions based on the provided topic.
function fetchQuizQuestions(topic) {
    showTypingAnimation();
    fetch('/ask', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic: topic }), // Send the topic as JSON
    })
        .then(response => response.json())
        .then(data => {
            removeTypingAnimation();
            if (typeof data === 'string') {
                try {
                    questions = JSON.parse(data);
                } catch (error) {
                    console.error('Error parsing questions:', error);
                    return;
                }
            } else {
                questions = data;
            }
            startQuiz(); // Start the quiz
        })
        .catch(error => {
            removeTypingAnimation();
            console.error('Error:', error);
            questionElement.innerHTML = "Failed to load quiz.";
        });
}

// Function to handle user input and initiate actions.
function sendMessage() {
    const textarea = document.querySelector('.typing-textarea textarea');
    const message = textarea.value.trim();
    textarea.value = '';

    if (message) {
        displayMessage('user', message);
        // First, call the '/gpt-determine-action' endpoint
        fetch('/gpt-determine-action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        })
        .then(response => response.json())
        .then(data => {
            if(data.type === 'image') {
                // If the type is image, call the 'handleImageGenerationCommand' function
                handleImageGenerationCommand(data.keyword);
            } else {
                // If the type is text, determine the next step based on the 'answerConfirmed' status
                let endpoint = answerConfirmed ? '/stream' : '/hint';
                fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message: message, currentQuestion: currentQuestion, options: currentOptions })
                })
                .then(response => response.body.getReader())
                .then(reader => readStream(reader));
            }
        })
        .catch(error => console.error('Error:', error));
    }
}

// Function to handle image generation command and display generated images.
function handleImageGenerationCommand(prompt) {
    updateOrDisplayAssistantMessage("Here is a photo of " + prompt);
    showImageLoader();
    fetch('/generate-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt }),
    })
    .then(response => response.json())
    .then(data => {
        if(data.imageUrl) {
            // Remove the loader animation
            removeImageLoader();
            displayGeneratedImage(data.imageUrl); // Display the image
        }
    })
    .catch(error => console.error('Error:', error));
}

// Function to display generated images in the chat.
function displayGeneratedImage(imageUrl) {
    // Get the chat container
    const chatContainer = document.querySelector('.chat-container');
    
    // Create a new chat message element
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    // Create an image element and set its source URL and CSS class
    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.alt = 'Generated content';
    imgElement.classList.add('chat-image');  // Apply CSS class

    // Append the image element to the message element
    messageDiv.appendChild(imgElement);
    
    // Append the message element to the chat container
    chatContainer.appendChild(messageDiv);
    
    // Scroll the chat container to the bottom to show the new message
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

let accumulatedText = ''; // Variable to accumulate received text blocks

async function readStream(reader, source) {
    const decoder = new TextDecoder();
    let isFirstChunk = true;
    let completeMessage = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break; 
            }
            let chunk = decoder.decode(value, { stream: true });
            completeMessage += chunk;
           updateOrDisplayAssistantMessage(chunk);
        }
    } catch (error) {
        console.error('Error reading the stream:', error);
    }
    await playTextAsSpeech(completeMessage);
    completeMessage = ''; // reset accumlated message
    isFirstChunk = true;
    if (source === 'explain') {
        searchAndDisplayVideo(currentQuestion);//recommend youtube video based on current question
        nextButton.style.display = "block";
    }
}

function searchAndDisplayVideo(query) {
    fetch('/search-video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query }),
    })
    .then(response => response.json())
    .then(data => {
        displayYouTubeVideo(data.videoTitle, data.videoUrl);
    })
    .catch(error => console.error('Error:', error));
}
function updateOrDisplayAssistantMessage(chunk) {
    const chatContainer = document.querySelector('.chat-container');
    let lastMessage = chatContainer.querySelector('.assistant-message:last-child .message-content');
    
    if (lastMessage) {
        lastMessage.textContent += chunk; // Append new text chunk to the last assistant message
    } else {
        displayMessage('assistant', chunk); // There is no last assistant message, display a new one
    }
    
    // Scroll to the bottom of the chat container
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
function displayMessage(sender, message) {
  const chatContainer = document.querySelector('.chat-container');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender + '-message');

  const avatarLabelContainer = document.createElement('div');
  avatarLabelContainer.classList.add('avatar-label-container');

  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('avatar');
  const avatarImg = document.createElement('img');
  avatarImg.src = sender === 'user' ? '/static/images/user.png' : '/static/images/assistant.png';
  avatarDiv.appendChild(avatarImg);

  const labelDiv = document.createElement('div');
  labelDiv.classList.add('label');
  labelDiv.textContent = sender === 'user' ? 'You' : 'ChatGPT';

  avatarLabelContainer.appendChild(avatarDiv);
  avatarLabelContainer.appendChild(labelDiv);

  const messageContentDiv = document.createElement('div');
  messageContentDiv.classList.add('message-content');
  messageContentDiv.textContent = message;

  messageDiv.appendChild(avatarLabelContainer);
  messageDiv.appendChild(messageContentDiv);

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
function displayYouTubeVideo(title, url) {
    if (!url) return;

    const chatContainer = document.querySelector('.chat-container');
    const videoDiv = document.createElement('div');
    videoDiv.classList.add('youtube-video');
    const description = `I found this video titled "${title}" that might help you learn more about the topic.`;
    playTextAsSpeech(description);
    const videoId = url.split('watch?v=')[1];
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;

    const videoIframe = document.createElement('iframe');
    videoIframe.src = embedUrl;
    videoIframe.title = title;
    videoIframe.frameBorder = "0";
    videoIframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    videoIframe.allowFullscreen = true;
    videoIframe.style.width = '50%'; 
    videoIframe.style.height = '40%'; 

    videoDiv.appendChild(videoIframe);
    chatContainer.appendChild(videoDiv);
    updateOrDisplayAssistantMessage(description);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function playTextAsSpeech(text) {
    return new Promise((resolve, reject) => {
        fetch('/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        })
        .then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(url); // Clean up the URL
                resolve(); // Resolve the promise when audio playback ends
            });
            audio.play();
        })
        .catch(error => {
            console.error('Error:', error);
            reject(error); 
        });
    });
}
let currentQuestionIndex = 0;
let score = 0;

function startQuiz(){
    currentQuestionIndex = 0;
    score = 0;
    nextButton.innerHTML = "Next";
    showQuestion();
}

function showQuestion(){
    resetState();
    answerConfirmed = false;
    fetchQuestionData();
    let currentQuestion = questions[currentQuestionIndex];

    let questionNo = currentQuestionIndex + 1;
    questionElement.innerHTML = questionNo + ". " + currentQuestion.question;

    currentQuestion.answers.forEach(answer => {
        const button = document.createElement("button");
        button.innerHTML = answer.text;
        button.classList.add("btn");
        answerButtons.appendChild(button);
        if(answer.correct){
            button.dataset.correct = answer.correct;
        }
        button.addEventListener("click", selectAnswer);
    });
}

function showTypingAnimation() {
    const typingAnimationHtml = `<div class="typing-animation">
                                    <div class="loader"></div>
                                 </div>`;
    const animationContainer = document.getElementById('animation-container');
    animationContainer.innerHTML = typingAnimationHtml;
}

function removeTypingAnimation() {
    const animationContainer = document.getElementById('animation-container');
    animationContainer.innerHTML = '';
}
function showImageLoader() {
    const chatContainer = document.querySelector('.chat-container');
    const loaderHtml = `<div class="image-loader"></div>`;
    chatContainer.insertAdjacentHTML('beforeend', loaderHtml);
}

function removeImageLoader() {
    const imageLoader = document.querySelector('.image-loader');
    if (imageLoader) {
        imageLoader.remove();
    }
}


function resetState(){
    showConfirmButton();
    nextButton.style.display = "none";
    while(answerButtons.firstChild){
        answerButtons.removeChild(answerButtons.firstChild);
    }
}

let selectedAnswerButton = null;

function selectAnswer(e) {
    console.log("Clicked button:", e.target);
    if (selectedAnswerButton) {
        selectedAnswerButton.classList.remove("selected");
    }
    selectedAnswerButton = e.target;
    selectedAnswerButton.classList.add("selected");
    const confirmButton = document.getElementById('confirm-btn');
    confirmButton.removeAttribute('disabled');
    confirmButton.classList.add('green-btn');
}


function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'toast-message'; 
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show'); 
        setTimeout(() => {
            toast.classList.remove('show'); 
            setTimeout(() => document.body.removeChild(toast), 500); 
        }, 3000); 
    }, 100); 
}

function confirmAnswer() {
    answerConfirmed = true;
    
    if (!selectedAnswerButton) {
        console.error('No answer selected');
        showToast("Please select an answer before confirming.");
        return;
    }
    selectedAnswerButton.classList.remove("selected");
    const isCorrect = selectedAnswerButton.dataset.correct === "true";
    if (isCorrect) {
        console.log("correct")
        const correctSound = document.getElementById('correct-sound');
        correctSound.play();
        selectedAnswerButton.classList.add("correct");
        score++;
    } else {
        const incorrectSound = document.getElementById('incorrect-sound');
        incorrectSound.play();
        selectedAnswerButton.classList.add("incorrect");
    }

    Array.from(answerButtons.children).forEach(button => {
        button.disabled = true;
        if (button.dataset.correct === "true") {
            button.classList.add("correct");
        }
    });

    document.getElementById('confirm-btn').style.display = 'none'; 
    displayMessage('user', selectedAnswerButton.textContent);
  
    let postData = {
        currentQuestion: currentQuestion,
        selectedOption: selectedAnswerButton.textContent,
        isCorrect: isCorrect,
        options: currentOptions
    };
    showToast("Feedback generating ...");
    
    fetch('/explain', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
    })
    .then(response => {
        const reader = response.body.getReader();
        readStream(reader, 'explain');
    })
    .catch(error => console.error('Error:', error));
}




function showConfirmButton() {
    let confirmButton = document.getElementById('confirm-btn');
    if (!confirmButton) {
        confirmButton = document.createElement('button');
        confirmButton.id = 'confirm-btn';
        confirmButton.textContent = 'Confirm';
        confirmButton.classList.add('btn');
        document.querySelector('.quiz-container').appendChild(confirmButton);
    }
    confirmButton.style.display = 'block';
    confirmButton.disabled = true;
    console.log('Confirm button should be visible now');
    confirmButton.addEventListener('click', confirmAnswer);
}


function showScore() {
    resetState();
    questionElement.innerHTML = `You scored ${score} out of ${questions.length}!`;

    // Create a button to return to the main menu
    const quizApp = document.getElementById('quiz-app');
    const startScreen = document.getElementById('start-screen');
    const backButton = document.createElement("button")
    backButton.innerHTML = "Back to Main Menu";
    backButton.classList.add("btn");
    backButton.addEventListener("click", () => {
        questionElement.innerHTML = "Generating new quiz";

        // Switch views
        quizApp.style.display = 'none';
        startScreen.style.display = 'block';

        // Reset state
        currentQuestionIndex = 0;
        score = 0;
        resetState();
    });

    // Add the back button to the interface
    answerButtons.appendChild(backButton);
    //nextButton.innerHTML = "Play Again";
    //nextButton.style.display = "block";
}

function handleNextButton(){
    currentQuestionIndex++;
    if(currentQuestionIndex < questions.length){
        showQuestion();
    }else{
        showScore();
    }
}


nextButton.addEventListener("click", ()=>{
    if(currentQuestionIndex < questions.length){
        handleNextButton();
    }else{
        startQuiz();
    }
});

startQuiz();
