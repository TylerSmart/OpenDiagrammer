using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenDiagrammer.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBoardRevisions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BoardRevisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BoardId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(2000)",
                        maxLength: 2000,
                        nullable: true
                    ),
                    CanvasDataJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CrdtState = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BoardRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BoardRevisions_Boards_BoardId",
                        column: x => x.BoardId,
                        principalTable: "Boards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_BoardRevisions_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_BoardRevisions_BoardId_CreatedAt",
                table: "BoardRevisions",
                columns: new[] { "BoardId", "CreatedAt" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_BoardRevisions_CreatedById",
                table: "BoardRevisions",
                column: "CreatedById"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "BoardRevisions");
        }
    }
}
