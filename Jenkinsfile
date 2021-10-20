#! groovy
library 'pipeline-library'

withCredentials([ string(credentialsId: 'oauth-github-api', variable: 'GITHUB_TOKEN')]) { 
	buildNPMPackage {
		npmVersion = '6.1.0'
		downstream = [ '../appc-cli' ]
		projectKey = 'TIMOB'
	}
}
