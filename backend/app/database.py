from sqlmodel import Session, create_engine


DATABASE_URL = "sqlite:///gadget.db"


engine = create_engine(
    DATABASE_URL,
    echo=True,
    connect_args={
        "check_same_thread": False
    }
)


def get_session():
    with Session(engine) as session:
        yield session