const soap = require('soap')
const fs = require('fs').promises
const path = require('path')
const {
    Worker,
    isMainThread,
    parentPort,
    workerData,
} = require('node:worker_threads')

async function createFilePath() {
    const now = new Date()
    const datePath = now.toISOString().split('T')[0]
    const timePath = now.toTimeString().split(' ')[0].replace(/:/g, '')
    const milliseconds = now.getMilliseconds()
    const directoryPath = path.join(__dirname, datePath)

    try {
        await fs.access(directoryPath)
    } catch (error) {
        await fs.mkdir(directoryPath)
    }

    const fileName = `${timePath}-${milliseconds}.json`
    const filePath = path.join(directoryPath, fileName)
    return filePath
}

const authenticationURL =
    'http://b2b.peninsula.com.tr/sws/Authentication.asmx?WSDL'
const databaseName = ''
const userName = ''
const password = ''
let token = ''

async function getToken() {
    try {
        const client = await soap.createClientAsync(authenticationURL)
        const loginArgs = { databaseName, userName, password }
        const loginResult = await client.LoginAsync(loginArgs)
        const authKey = loginResult[0].LoginResult.AuthKey
        return authKey
    } catch (error) {
        console.error('Token alma hatası:', error)
    }
}

async function sendSoapRequest(token) {
    const url = 'http://b2b.peninsula.com.tr/sws/Export.asmx?WSDL'
    const requestArgs = {
        token: token,
        Params: {
            HotelCodes: { string: 'BOSIRE' },
            SeasonNumbers: { string: '' },
            LastExportDate: '0001-01-01T00:00:00',
            Changed_Spo_No: '',
            GenerationOptions: {
                NonGenerateStopSales: false,
                NonGenerateFreeSales: false,
                NonGenerateMinStays: false,
                NonGenerateReleases: false,
                NonGenerateExtras: false,
                GenerateAllPeriods: false,
                GenerateUniqueIDs: false,
                GenerateUniqueIDsAndKeepExportHistory: false,
                GenerateWeekendPrices: true,
                GenerateAllRevisePrices: true,
                GenerateSPOPaymentPlans: true,
                GenerateContractPaymentPlans: true,
                GenerateHandlingFees: true,
                GenerateKickbacks: true,
                GenerateCancelationRules: true,
                SpecialOfferGenerationOptions: {
                    NonGenerateNormalSpo: false,
                    NonGenerateEarlyBookings: false,
                    NonGenerateDayPromotions: false,
                    NonGenerateRollingEarlyBookings: false,
                    NonGenerateTurboEarlyBookings: false,
                    NonGenerateLongStay: false,
                    NonGenerateChildPriceSpo: false,
                    NonGenerateUpgradeSpo: false,
                    NonGenerateHoneyMoonSpo: false,
                },
            },
        },
    }

    try {
        const client = await soap.createClientAsync(url)
        const result = await client.GetSejourContractExportViewAsync(
            requestArgs
        )
        const filePath = await createFilePath()
        fs.writeFile(filePath, JSON.stringify(result), 'utf8')
        console.log('SOAP isteği sonucu:', result)
    } catch (error) {
        const filePath = await createFilePath()
        fs.writeFile(filePath, `SOAP isteği hatası: ${error.message}`, 'utf8')
        console.error('SOAP isteği hatası:', error)
    }
}

if (!isMainThread) {
    async function workerFunction() {
        if (token == '') {
            token = await getToken()
        }
        const startTime = Date.now()

        while (Date.now() - startTime < workerData.duration) {
            await sendSoapRequest(token)
        }

        parentPort.close()
    }

    workerFunction()
}

if (isMainThread) {
    function startLoadTest(threadCount, duration) {
        for (let i = 0; i < threadCount; i++) {
            const worker = new Worker(__filename, {
                workerData: { duration },
            })

            worker.on('message', (message) => {
                console.log(message)
            })

            worker.on('exit', () => {
                console.log(`Worker ${worker.threadId} exited`)
            })
        }
    }

    const threadCount = 5
    const duration = 1000

    startLoadTest(threadCount, duration)
}
