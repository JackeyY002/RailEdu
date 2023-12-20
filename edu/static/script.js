let questions = [];
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const quizApp = document.getElementById('quiz-app');
    
    // Event handler for clicking the start button
    startButton.addEventListener('click', () => {
        const topic = document.querySelector('input.topic-input').value.trim() || 'rail and transportation';
        startScreen.style.display = 'none'; // Hide the start screen
        quizApp.style.display = 'block'; // Show the quiz interface
        fetchQuizQuestions(topic); // Fetch questions
    });
    let confirmButton = document.getElementById('confirm-btn');
    if (confirmButton) {
        confirmButton.addEventListener('click', confirmAnswer);
    }

    const textarea = document.querySelector('.typing-textarea textarea');
    textarea.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); 
            sendMessage(); 
        }
    });
});


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

const questionElement = document.getElementById("question");
const answerButtons = document.getElementById("answer-buttons");
const nextButton = document.getElementById("next-btn");
document.querySelector('.material-symbols-rounded').addEventListener('click', sendMessage);
let currentQuestion = null;
let currentOptions = null;
let selectedAnswer = null;
let answerConfirmed = false;

function fetchQuestionData() {
    currentQuestion = questions[currentQuestionIndex].question;
    currentOptions = questions[currentQuestionIndex].answers;
}


function sendMessage() {
    const textarea = document.querySelector('.typing-textarea textarea');
    const message = textarea.value.trim();
    textarea.value = '';

    if (message) {
        displayMessage('user', message);

        let endpoint = answerConfirmed ? '/stream' : '/hint';
        let postData = {
            message: message,
            currentQuestion: currentQuestion,
            options: currentOptions
        };

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
        })
        .then(response => {
            const reader = response.body.getReader();
            readStream(reader);
        })
        .catch(error => console.error('Error:', error));
    }
}


async function readStream(reader, source) {
    let accumulatedText = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                displayMessage('assistant', accumulatedText);
                if (source === 'explain') {
                    nextButton.style.display = "block";
                }
                break;
            }
            const chunk = new TextDecoder().decode(value, { stream: true });
            accumulatedText += chunk;
        }
    } catch (error) {
        console.error('Error reading the stream:', error);
        if (source === 'explain') {
            nextButton.style.display = "block";
        }
    }
}

function displayMessage(sender, message) {
    const chatContainer = document.querySelector('.chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add(sender + '-message');

    if (sender === 'user') {
        messageDiv.classList.add('user-message');
    } else {
        messageDiv.classList.add('assistant-message');
    }

    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');
    messageContentDiv.textContent = message;

    messageDiv.appendChild(messageContentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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

function resetState(){
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
    showConfirmButton();
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
    console.log('Confirm button clicked');
    
    if (!selectedAnswerButton) {
        console.error('No answer selected');
        showToast("Please select an answer before confirming.");
        return;
    }
    selectedAnswerButton.classList.remove("selected");
    const isCorrect = selectedAnswerButton.dataset.correct === "true";
    if (isCorrect) {
        selectedAnswerButton.classList.add("correct");
        score++;
    } else {
        selectedAnswerButton.classList.add("incorrect");
    }

    Array.from(answerButtons.children).forEach(button => {
        button.disabled = true;
        if (button.dataset.correct === "true") {
            button.classList.add("correct");
        }
    });

    document.getElementById('confirm-btn').style.display = 'none'; 

  
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
