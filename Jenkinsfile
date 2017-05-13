#! groovy
library 'pipeline-library'

timestamps {
	node('(osx || linux) && git && npm-publish') {
		def packageVersion = ''
		def isMaster = false

		stage('Checkout') {
			checkout scm

			isMaster = env.BRANCH_NAME.equals('master')
			packageVersion = jsonParse(readFile('package.json'))['version']
			currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"
		}

		nodejs(nodeJSInstallationName: 'node 4.7.3') {
			ansiColor('xterm') {
				timeout(55) {
					stage('Build') {
						// Install yarn if not installed
						if (sh(returnStatus: true, script: 'which yarn') != 0) {
							// TODO Install using the curl script via chef before-hand?
							// sh 'curl -o- -L https://yarnpkg.com/install.sh | bash'
							sh 'npm install -g yarn'
						}
						sh 'yarn install'

						try {
							sh 'yarn test'
						} finally {
							junit 'junit_report.xml'
						}
						fingerprint 'package.json'

						// Only tag master
						if (isMaster) {
							pushGitTag(name: packageVersion, message: "See ${env.BUILD_URL} for more information.", force: true)
						}
					} // stage

					stage('Publish') {
						// only publish master and trigger downstream
						if (isMaster) {
							sh 'npm publish'
							// Trigger appc-cli-wrapper job
							build job: 'appc-cli-wrapper', wait: false
						}
					} // stage
				} // timeout
			} // ansiColor
		} // nodejs
	} // node
} // timestamps
