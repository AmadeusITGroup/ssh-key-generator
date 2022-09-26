# Development

A guide of developing `SSH key generator` extension.

## Requirements

* VS Code
* Node.js (npm is part of node.js)
  * [Downloads link](https://nodejs.org/en/download/)
  * [Installation for Linux](https://github.com/nodesource/distributions/blob/master/README.md#debinstall)


## Building, running, and testing (with VSCode)


* Git clone the project
* Install the recommanded extensions
* Create a branch from `master`
* Run the task `npm_install` available from the view `Task Runner`
* Once your code is ready, run the task `recompile`
* You can test your code by pressing F5, it opens a new VSCode windows on which you can try all commands and yours changes
* Before to push your code run the task `pre-commit`. 
  * It runs the tests, linter, package

**If you change dependencies in `package.json`, you should run `npm install`.**

## Debugging (with VSCode)

* Add breakpoints
* Open the view `Run and Debug`
* Select `Run Extension`
* Click on the green arrow

VSCode will recompile the sources for you before launching.


# Coding rules

## Source code
To ensure consistency and quality throughout the source code, all code modifications must have:

* No linting errors
* A test for every new path introduced by your code change
  * High code coverage - we're aiming at 100% ideally, but we're pragmatic
* Meaningful [commit message(s)](#Commit-messages)
* Documentation for new features
* Updated documentation for modified features

## Linter
Prettier formatting is automatically verified and fixed when running the `pre-commit` task.

You can run the linter manually by running the task `lint` and `fix-lint`

## Tests
Similarly to the linter, tests are executed when you run the `pre-commit` task.

You can run the test manually by running the `test` task.

## Commit messages

Our CICD uses the commit messages to determine the consumer impact of changes in the codebase and it automatically determines the next semantic version number.

By default, it uses the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). 

Find below somes commit messages exemple:

* **fix: ssh connection** a commit of the type fix patches a bug in your codebase.
* **feat: Add new setting** a commit of the type feat introduces a new feature to the codebase.
* **BREAKING CHANGE:** a commit that has a footer BREAKING CHANGE:, or appends a ! after the type, introduces a breaking API change
* types other than fix: and feat: are allowed, for example build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, and others.


### Debug the test
* Add breakpoints
* Open the view Run and Debug
* Select `Extension Tests`
* Click on the green arrow


# Submitting a Pull Request
* Once all previous steps are completed
* Open a Pull Request with a clear title and description.
* A github action is automatically run, and could take ~5min, **check its status**

