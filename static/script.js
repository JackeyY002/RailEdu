document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const quizApp = document.getElementById('quiz-app');

    // Event handler for clicking the start button
    startButton.addEventListener('click', () => {
        startScreen.style.display = 'none'; // Hide the start screen
        quizApp.style.display = 'block'; // Show the quiz interface
        fetchQuizQuestions(); // Fetch questions
    });
});


function fetchQuizQuestions() {
    showTypingAnimation();
    fetch('https://12431dc6f53af306.ngrok.app/ask')
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

function selectAnswer(e){
    const selectedBtn = e.target;
    const isCorrect = selectedBtn.dataset.correct === "true";
    if(isCorrect){
        selectedBtn.classList.add("correct");
        score++;
    }else{
        selectedBtn.classList.add("incorrect");
    }
    Array.from(answerButtons.children).forEach(button => {
        if(button.dataset.correct === "true"){
            button.classList.add("correct");
        }
        button.disabled = true;
    });
    nextButton.style.display = "block";
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

    nextButton.innerHTML = "Play Again";
    nextButton.style.display = "block";
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
