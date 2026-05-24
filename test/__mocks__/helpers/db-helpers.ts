import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

export interface TestDatabaseOptions {
  schemaPath?: string
  dbName?: string
}

export async function setupTestDatabase(options: TestDatabaseOptions = {}): Promise<Database.Database> {
  const { schemaPath, dbName } = options
  
  const dbPath = dbName || `data/test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.db`
  const db = new Database(dbPath)
  
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  
  const defaultSchemaPath = path.join(process.cwd(), 'init_db.py')
  const schemaFilePath = schemaPath || defaultSchemaPath
  
  if (fs.existsSync(schemaFilePath)) {
    try {
      if (schemaFilePath.endsWith('.sql')) {
        const schema = fs.readFileSync(schemaFilePath, 'utf-8')
        db.exec(schema)
      } else if (schemaFilePath.endsWith('.py')) {
        console.warn('Python schema files are not supported in tests. Please provide a .sql schema file.')
      }
    } catch (error) {
      console.warn('Failed to load schema file:', error)
    }
  }
  
  return db
}

export async function teardownTestDatabase(db: Database.Database): Promise<void> {
  try {
    const dbPath = (db as any).name
    
    if (db && typeof db.close === 'function') {
      db.close()
    }
    
    if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
      
      const walFile = `${dbPath}-wal`
      const shmFile = `${dbPath}-shm`
      
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile)
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile)
    }
  } catch (error) {
    console.warn('Failed to teardown test database:', error)
  }
}

export async function seedTestData(
  db: Database.Database,
  options: {
    jobsCount?: number
    usersCount?: number
    subscriptionsCount?: number
  } = {}
): Promise<void> {
  const { jobsCount = 10, usersCount = 2, subscriptionsCount = 5 } = options
  
  try {
    const insertJob = db.prepare(`
      INSERT OR IGNORE INTO jobs (title, company, location, salary, description, requirements, source, tags, industry)
      VALUES (@title, @company, @location, @salary, @description, @requirements, @source, @tags, @industry)
    `)
    
    const jobs = Array.from({ length: jobsCount }, (_, i) => ({
      title: `测试职位${i + 1}`,
      company: `测试公司${i + 1}`,
      location: ['北京', '上海', '深圳'][i % 3],
      salary: `${10 + i * 5}-${20 + i * 5}K`,
      description: `这是第${i + 1}个测试职位的描述`,
      requirements: `这是第${i + 1}个测试职位的要求`,
      source: ['boss直聘', '猎聘', '拉勾'][i % 3],
      tags: 'Python,SQL',
      industry: '互联网',
    }))
    
    const insertManyJobs = db.transaction((jobList: typeof jobs) => {
      for (const job of jobList) {
        insertJob.run(job)
      }
    })
    
    insertManyJobs(jobs)
  } catch (error) {
    console.warn('Failed to seed test data:', error)
  }
}

export function withTransaction<T>(db: Database.Database, fn: () => T): T {
  db.exec('BEGIN TRANSACTION')
  
  try {
    const result = fn()
    db.exec('ROLLBACK')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function createInMemoryDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}
