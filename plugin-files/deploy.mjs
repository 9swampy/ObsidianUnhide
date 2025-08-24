import fs from 'fs';
import path from 'path';

const DEPLOYMENT_CONFIG = {
    targetDir: '../.obsidian/plugins/obsidian-unhide',
    filesToDeploy: ['main.js', 'manifest.json'],
    messages: {
        cleaning: '🧹 Cleaning target directory...',
        deploying: '📦 Deploying built files...',
        success: '🎯 Clean deployment complete!',
        location: '📂 Plugin deployed to:',
        reload: '🔄 Reload plugin in Obsidian to test'
    }
};

async function cleanTargetDirectory() {
    console.log(DEPLOYMENT_CONFIG.messages.cleaning);
    
    if (fs.existsSync(DEPLOYMENT_CONFIG.targetDir)) {
        fs.rmSync(DEPLOYMENT_CONFIG.targetDir, { recursive: true, force: true });
    }
    
    fs.mkdirSync(DEPLOYMENT_CONFIG.targetDir, { recursive: true });
}

async function deployFiles() {
    console.log(DEPLOYMENT_CONFIG.messages.deploying);
    
    for (const file of DEPLOYMENT_CONFIG.filesToDeploy) {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(DEPLOYMENT_CONFIG.targetDir, file));
            console.log(`✅ ${file}`);
        } else {
            console.error(`❌ ${file} not found`);
            process.exit(1);
        }
    }
}

function reportSuccess() {
    console.log(`\n${DEPLOYMENT_CONFIG.messages.success}`);
    console.log(`${DEPLOYMENT_CONFIG.messages.location} ${path.resolve(DEPLOYMENT_CONFIG.targetDir)}`);
    console.log(DEPLOYMENT_CONFIG.messages.reload);
}

async function main() {
    try {
        await cleanTargetDirectory();
        await deployFiles();
        reportSuccess();
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

main();