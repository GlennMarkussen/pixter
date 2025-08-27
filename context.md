# Background

We want to create a guessing game with at least two players. Player one will describe a scene / picture. This information is forwarded to OpenAI / ChatGPT which generates a picture. The picture is then shown to player two who has to describe the picture.

The description should be sent back to OpenAI / ChatGPT which will determine if player two guessed correctly or not. The player sequence should then be flipped so that player two provides the initial descripion while player one attempts to guess what it is.

# How the game works aka scoring

Every player starts with zero points. Every time a player makes a wrong guess, they receive a penalty of 10 points. The game ends when a player has guessed correctly or reach -100 points.

# Participants

The players are named Jonas the Red and Erna the Blue. Which player starts is selected randomly.

# Technology stack

It's all up to you which tech stack should be used, the only requirement is that it should work in a browser.
