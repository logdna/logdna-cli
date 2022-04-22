library 'magic-butler-catalogue'

def PROJECT_NAME = 'logdna-cli'
def CURRENT_BRANCH = [env.CHANGE_BRANCH, env.BRANCH_NAME]?.find{branch -> branch != null}
def DEFAULT_BRANCH = 'master'
def TRIGGER_PATTERN = ".*@logdnabot.*"
def DRY_RUN = CURRENT_BRANCH != DEFAULT_BRANCH
def CHANGE_ID = env.CHANGE_ID == null ? '' : env.CHANGE_ID

pipeline {
  agent none

  options {
    timestamps()
    ansiColor 'xterm'
  }

  triggers {
    issueCommentTrigger(TRIGGER_PATTERN)
  }

  environment {
    GITHUB_TOKEN = credentials('github-api-token')
    NPM_TOKEN = credentials('npm-publish-token')
    NPM_CONFIG_CACHE = '.npm'
    NPM_CONFIG_USERCONFIG = '.npmrc'
    SPAWN_WRAP_SHIM_ROOT = '.npm'
  }

  stages {

    stage('Test Release') {
      when {
        beforeAgent true
        not {
          branch DEFAULT_BRANCH
        }
      }

      agent {
        docker {
          image "us.gcr.io/logdna-k8s/node:14-ci"
          customWorkspace "${PROJECT_NAME}-${BUILD_NUMBER}"
        }
      }

      environment {
        GIT_BRANCH = "${CURRENT_BRANCH}"
        BRANCH_NAME = "${CURRENT_BRANCH}"
        CHANGE_ID = ""
      }

      steps {
        sh 'npm install'
        sh 'npm run release:dry'
      }
    }

    stage ('Release') {
      agent {
        docker {
          image "us.gcr.io/logdna-k8s/node:14-ci"
          customWorkspace "${PROJECT_NAME}-${BUILD_NUMBER}"
        }
      }

      when {
        beforeAgent true
        branch DEFAULT_BRANCH
        not {
          changelog '\\[skip ci\\]'
        }
      }

      steps {
        sh "mkdir -p ${NPM_CONFIG_CACHE}"
        sh 'npm install'
        sh 'npm run release'
      }
    }
  }
}
