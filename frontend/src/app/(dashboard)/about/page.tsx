import Image from "next/image";
import styles from "./about.module.css";

type TeamMember = {
  name: string;
  role: string;
  description: string;
  image: string;
};

const team: TeamMember[] = [
  {
    name: "Calvin Bayno O'Flaherty",
    role: "PROJECT MANAGER",
    description: "Hi my name is Calvin, I am studying a Bachelor of Computer Science",
    image: "/team/calvin_dev2.jpg",
  },
  {
    name: "Punya Mishra",
    role: "BUSINESS ANALYST",
    description: "Hi my name is Punya, I am studying a Bachelor of Computer Science",
    image: "/team/punya_dev.jpg",
  },
  {
    name: "Shah Fahad Ali",
    role: "UX / UI DESIGNER",
    description: "Hi my name is Fahad, I am studying a Bachelor of Computer Science",
    image: "/team/fahad_dev.jpg",
  },
  {
    name: "Matthew Rasip",
    role: "SOFTWARE DEVELOPER",
    description: "Hi my name is Matthew, I am studying a Bachelor of Information Technology",
    image: "/team/matthew_dev2.jpg",
  },
  {
    name: "Renil Ben Mathews",
    role: "SOFTWARE DEVELOPER",
    description: "Hi my name is Renil, I am studying a Bachelor of Informaiton Technology",
    image: "/team/renil_dev.jpg",
  },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <h1 className={styles.title}>Meet the team:</h1>

        <div className={styles.teamGrid}>
          {team.map((member) => (
            <article
              key={member.name}
              className={`${styles.card}`}
            >
              <div className={styles.photoArea}>
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className={styles.photo}
                />
              </div>

              <div className={styles.cardContent}>
                <span className={styles.role}>
                  {member.role}
                </span>

                <h2 className={styles.name}>
                  {member.name}
                </h2>

                <p className={styles.description}>
                  {member.description}
                </p>

                <div className={styles.divider} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}