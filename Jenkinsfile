#! groovy
library 'pipeline-library'
def nodeVersion = '8.9.1'
def npmVersion = '6.1.0'

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

		nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
			ansiColor('xterm') {
				timeout(55) {
					stage('Build') {

						ensureNPM(npmVersion)
						sh 'npm ci'

						try {
							sh 'npm test'
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
							// Trigger appc-cli job
							build job: '../appc-cli/master', wait: false
						}
					} // stage
				} // timeout
			} // ansiColor
		} // nodejs
	} // node
} // timestamps
